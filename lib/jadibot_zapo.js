import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import Database from 'better-sqlite3';
import axios from 'axios';
import {
    WaClient,
    createStore,
    createPinoLogger,
    WA_BROWSERS,
    WA_DISCONNECT_REASONS
} from 'zapo-js';
import { createSqliteStore } from '@zapo-js/store-sqlite';
import { createMediaProcessor } from '@zapo-js/media-utils';
import { handlePluginMessage } from './plugin_manager.js';
import { smsg } from './simple.js';
import { evaluateAntiCall } from './anti_call.js';

function normalizeJid(jid) {
    if (!jid) return '';
    const clean = String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    return `${clean}@s.whatsapp.net`;
}

const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

export const jadibotConns = new Map();
global.jadibotConns = jadibotConns;
const sessionCache = new Map();
const processor = createMediaProcessor();
const browser = WA_BROWSERS?.ubuntu ? WA_BROWSERS.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '20.0.04'];

function isSessionExplicitlyLoggedOut(statusCode, reason = '') {
    const code = Number(statusCode);
    return (
        code === 401 ||
        code === 403 ||
        code === WA_DISCONNECT_REASONS?.LOGGED_OUT ||
        code === WA_DISCONNECT_REASONS?.STREAM_ERROR_DEVICE_REMOVED ||
        /logged\s*out|device\s*removed|unregistered/i.test(String(reason))
    );
}

export class JadiBotConnection {
    constructor(sessionName, options = {}) {
        this.sessionName = sessionName;
        this.options = options;
        this.conn = null;
        this.store = null;
        this.isDestroyed = false;
        this.number = options.number || sessionName;
        this.sessionFolder = path.join(SESSIONS_DIR, this.sessionName);
        this.meCachePath = path.join(this.sessionFolder, 'me.json');
        this.settingsPath = path.join(this.sessionFolder, 'settings.json');
        this.sqlitePath = path.join(this.sessionFolder, 'state.sqlite');
        this.watcher = null;
        this.checkInterval = null;
        jadibotConns.set(this.sessionName, this);
    }

    getSettings() {
        if (fs.existsSync(this.settingsPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
                return {
                    publicMode: typeof data.publicMode === 'boolean' ? data.publicMode : true,
                    groupMode: typeof data.groupMode === 'boolean' ? data.groupMode : true,
                    autoReadStatus: typeof data.autoReadStatus === 'boolean' ? data.autoReadStatus : false,
                    autoReadMessage: typeof data.autoReadMessage === 'boolean' ? data.autoReadMessage : false,
                    antiCall: typeof data.antiCall === 'boolean' ? data.antiCall : false
                };
            } catch (e) {}
        }
        return { publicMode: true, groupMode: true, autoReadStatus: false, autoReadMessage: false, antiCall: false };
    }

    updateSettings(newSettings = {}) {
        let data = this.getSettings();
        data = { ...data, ...newSettings };
        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {}
        return data;
    }

    getBotJid() {
        if (this.conn?._botJid) return this.conn._botJid;
        if (this.conn?.user?.id) return this.conn.user.id;
        const creds = this.conn?.auth?.credentials;
        const jid = creds?.pnJid || creds?.meJid || creds?.id || '';
        if (jid && !jid.includes('@lid')) return normalizeJid(jid);
        if (this.number) return `${this.number}@s.whatsapp.net`;
        return '';
    }

    getBotNumber() {
        const jid = this.getBotJid();
        if (jid) {
            const clean = jid.split('@')[0].replace(/[^0-9]/g, '');
            if (clean.length >= 7) return clean;
        }
        return String(this.number).replace(/[^0-9]/g, '') || this.sessionName;
    }

    getDisplayName() {
        if (this.conn?._botName && this.conn._botName.trim() && this.conn._botName.toLowerCase() !== 'user' && !this.conn._botName.includes('@')) {
            return this.conn._botName.trim();
        }

        const jid = this.getBotJid();
        if (jid && global.db?.data?.users?.[jid]?.name) {
            const dbName = global.db.data.users[jid].name.trim();
            if (dbName && dbName.toLowerCase() !== 'user' && !dbName.includes('@')) {
                return dbName;
            }
        }

        if (fs.existsSync(this.meCachePath)) {
            try {
                const cache = JSON.parse(fs.readFileSync(this.meCachePath, 'utf8'));
                if (cache.name && cache.name.trim() && !cache.name.includes('@')) {
                    return cache.name.trim();
                }
            } catch (e) {}
        }

        if (fs.existsSync(this.sqlitePath)) {
            try {
                const db = new Database(this.sqlitePath, { readonly: true });
                const row = db.prepare('SELECT me_display_name, push_name FROM auth_credentials LIMIT 1').get();
                db.close();
                const name = row?.me_display_name || row?.push_name;
                if (name && name.trim() && !name.includes('@')) {
                    return name.trim();
                }
            } catch (e) {}
        }

        const num = this.getBotNumber();
        return `+${num}`;
    }

    startWatcher() {
        this.stopWatcher();
        try {
            if (fs.existsSync(this.sessionFolder)) {
                this.watcher = fs.watch(this.sessionFolder, async () => {
                    if (!fs.existsSync(this.sessionFolder) && !this.isDestroyed) {
                        console.log(`[JadiBot ${this.sessionName}] Folder sesi dihapus manual, memutuskan koneksi...`);
                        await this.disconnect(false);
                    }
                });
            }
        } catch (e) {}

        this.checkInterval = setInterval(async () => {
            if (this.isDestroyed) return;
            if (!fs.existsSync(this.sessionFolder)) {
                console.log(`[JadiBot ${this.sessionName}] Folder sesi tidak ditemukan, memutuskan koneksi...`);
                await this.disconnect(false);
            }
        }, 5000);
    }

    stopWatcher() {
        if (this.watcher) {
            try { this.watcher.close(); } catch (e) {}
            this.watcher = null;
        }
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async start(runtimeOptions = {}) {
        this.isDestroyed = false;
        if (!fs.existsSync(this.sessionFolder)) {
            fs.mkdirSync(this.sessionFolder, { recursive: true });
        }

        this.startWatcher();

        let meCache = {};
        if (fs.existsSync(this.meCachePath)) {
            try { meCache = JSON.parse(fs.readFileSync(this.meCachePath, 'utf8')); } catch (e) {}
        }

        this.store = createStore({
            backends: {
                sqlite: createSqliteStore({ path: this.sqlitePath, driver: 'auto' })
            },
            providers: {
                auth: 'sqlite', signal: 'sqlite', preKey: 'sqlite', session: 'sqlite',
                identity: 'sqlite', senderKey: 'sqlite', appState: 'sqlite',
                privacyToken: 'sqlite', messages: 'sqlite', threads: 'sqlite', contacts: 'sqlite',
                retry: 'sqlite', groupMetadata: 'sqlite', deviceList: 'sqlite', messageSecret: 'sqlite'
            }
        });

        const logger = await createPinoLogger({ level: 'silent' });

        this.conn = new WaClient({
            store: this.store,
            sessionId: this.sessionName,
            deviceBrowser: 'Safari',
            deviceOsDisplayName: 'macOS',
            history: { enabled: false },
            media: { processor },
            ...this.options,
            ...runtimeOptions
        }, logger);

        if (meCache.jid && !meCache.jid.includes('@lid')) {
            this.conn._botJid = meCache.jid;
        }
        this.conn._botName = meCache.name || '';

        // Compatibility sendMessage wrapper
        this.conn.sendMessage = async (jid, content, sendOpts = {}) => {
            const quoted = sendOpts.quoted || content.contextInfo?.quoted;
            const extra = quoted ? { quote: quoted } : {};

            const rawMentions = sendOpts.mentions || content.mentions || content.contextInfo?.mentionedJid || [];
            const mentions = Array.isArray(rawMentions) ? rawMentions.filter(Boolean) : [];
            if (mentions.length > 0) {
                extra.mentions = mentions;
            }

            const resolveMedia = async (mediaInput) => {
                if (!mediaInput) return null;
                if (Buffer.isBuffer(mediaInput) || mediaInput instanceof Uint8Array) return mediaInput;
                if (typeof mediaInput === 'object' && mediaInput.url) {
                    const res = await axios.get(mediaInput.url, { responseType: 'arraybuffer', timeout: 30000 });
                    return Buffer.from(res.data);
                }
                if (typeof mediaInput === 'string') {
                    if (mediaInput.startsWith('http://') || mediaInput.startsWith('https://')) {
                        const res = await axios.get(mediaInput.url || mediaInput, { responseType: 'arraybuffer', timeout: 30000 });
                        return Buffer.from(res.data);
                    }
                    if (fs.existsSync(mediaInput)) return fs.readFileSync(mediaInput);
                }
                return mediaInput;
            };

            if (content.reactionMessage) {
                return this.conn.message.send(jid, { type: 'reaction', emoji: content.reactionMessage.text, target: content.reactionMessage.key });
            }

            if (content.delete) {
                const deleteKey = content.delete;
                const targetId = deleteKey?.id || (typeof deleteKey === 'string' ? deleteKey : '');
                if (targetId) {
                    return this.conn.message.send(jid, { type: 'revoke', target: { id: targetId, remoteJid: jid, fromMe: true } }, extra).catch(() => {});
                }
            }

            if (content.sticker) {
                const buf = await resolveMedia(content.sticker);
                return this.conn.message.send(jid, { type: 'sticker', media: buf }, extra);
            }
            if (content.image) {
                const buf = await resolveMedia(content.image);
                return this.conn.message.send(jid, { type: 'image', media: buf, caption: content.caption || '', mimetype: content.mimetype || 'image/jpeg' }, extra);
            }
            if (content.video) {
                const buf = await resolveMedia(content.video);
                return this.conn.message.send(jid, { type: 'video', media: buf, caption: content.caption || '', mimetype: content.mimetype || 'video/mp4' }, extra);
            }
            if (content.audio) {
                const buf = await resolveMedia(content.audio);
                return this.conn.message.send(jid, { type: 'audio', media: buf, mimetype: content.mimetype || 'audio/mp4', ptt: content.ptt || false }, extra);
            }
            if (content.document) {
                const buf = await resolveMedia(content.document);
                return this.conn.message.send(jid, { type: 'document', media: buf, mimetype: content.mimetype || 'application/octet-stream', fileName: content.fileName || 'file', caption: content.caption || '' }, extra);
            }
            if (content.text) {
                const payload = { type: 'text', text: content.text };
                if (mentions.length > 0) {
                    payload.contextInfo = payload.contextInfo || {};
                    payload.contextInfo.mentionedJid = mentions;
                }
                return this.conn.message.send(jid, payload, extra);
            }
            if (typeof content === 'string') {
                const payload = { type: 'text', text: content };
                if (mentions.length > 0) {
                    payload.contextInfo = payload.contextInfo || {};
                    payload.contextInfo.mentionedJid = mentions;
                }
                return this.conn.message.send(jid, payload, extra);
            }
            // Interactive / Native Flow / Rich message / Raw passthrough
            if (content && typeof content === 'object') {
                return this.conn.message.send(jid, content, extra);
            }
        };

        // Identitas & Pairing Handler
        const persistIdentity = (rawJid, name) => {
            if (!rawJid) return;
            const norm = normalizeJid(rawJid);
            if (!norm || norm.includes('@lid')) return;
            this.conn._botJid = norm;
            
            const cleanName = typeof name === 'string' ? name.trim() : '';
            if (cleanName && cleanName.toLowerCase() !== 'user' && !cleanName.includes('@')) {
                this.conn._botName = cleanName;
                if (global.db?.data?.users?.[norm]) {
                    global.db.data.users[norm].name = cleanName;
                    global.db.scheduleSave();
                }
            }

            try {
                fs.writeFileSync(this.meCachePath, JSON.stringify({ jid: norm, name: this.conn._botName || '' }, null, 2));
            } catch (e) {}
        };

        this.conn.on('auth_paired', async ({ credentials }) => {
            const meJid = credentials?.pnJid || credentials?.meJid || credentials?.id || '';
            const name = credentials?.meDisplayName || credentials?.name || credentials?.pushName || credentials?.notify;
            persistIdentity(meJid, name);
            const botNum = this.getBotNumber();
            const displayName = this.getDisplayName();
            console.log(`[JadiBot ${this.sessionName}] ✅ Berhasil dipasangkan! Nomor: +${botNum} (${displayName})`);

            if (this.parentConn && this.targetChat) {
                const s = sessionCache.get(this.sessionName);
                if (s) s.isLoggedIn = true;
                await this.parentConn.sendMessage(this.targetChat, {
                    text: `🎉 *JADIBOT BERHASIL TERHUBUNG!*\n\n• Nomor: *+${botNum}*\n• Nama: *${displayName}*\n• Sesi: *${this.sessionName}*\n• Status: *Aktif & Online*\n\n_Sub-bot sudah siap menerima perintah langsung dari chat/grup._`
                }, { quoted: this.quotedMsg });
            }
        });

        // Connection Handler
        this.conn.on('connection', async (event) => {
            if (event.status === 'open') {
                const runtimeJid = this.conn.auth?.credentials?.pnJid || this.conn.auth?.credentials?.meJid;
                const runtimeName = this.conn.auth?.credentials?.meDisplayName || this.conn.auth?.credentials?.name || this.conn.auth?.credentials?.notify || this.conn.auth?.credentials?.pushName;
                if (runtimeJid) persistIdentity(runtimeJid, runtimeName);
                console.log(`[JadiBot ${this.sessionName}] 📡 Status: ONLINE (+${this.getBotNumber()}) [${this.getDisplayName()}]`);
            } else if (event.status === 'close') {
                console.log(`[JadiBot ${this.sessionName}] ⚠️ Disconnected (${event.reason}) [Code: ${event.code}]`);
                if (isSessionExplicitlyLoggedOut(event.code, event.reason)) {
                    console.log(`[JadiBot ${this.sessionName}] 🔴 Sesi terputus karena logout dari perangkat.`);
                    await this.disconnect(true);
                } else if (!this.isDestroyed && fs.existsSync(this.sessionFolder)) {
                    // Reconnect otomatis jika putus jaringan sementara (jangan hapus file sesi!)
                    setTimeout(() => {
                        if (!this.isDestroyed && this.conn) {
                            console.log(`[JadiBot ${this.sessionName}] 🔄 Mencoba menyambung kembali...`);
                            this.conn.connect().catch(() => {});
                        }
                    }, 5000);
                }
            }
        });

        // QR / Pairing Flow
        this.conn.on('auth_qr', async ({ qr }) => {
            const s = sessionCache.get(this.sessionName);
            if (!s || s.isLoggedIn || s.isTerminated) return;

            if (this.mode === 'pairing' && this.number) {
                if (!s.codeSent) {
                    s.codeSent = true;
                    try {
                        const code = await this.conn.auth.requestPairingCode(this.number);
                        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                        s.code = formatted;

                        if (this.parentConn && this.targetChat) {
                            const tutor = `🔑 *KODE PAIRING JADIBOT*\n\nNomor: *+${this.number}*\nKode: *${formatted}*\n\n*Cara Menggunakan:*\n1. Buka WhatsApp di HP target\n2. Titik 3 / Pengaturan → Perangkat Tertaut\n3. Tautkan Perangkat → *Tautkan dengan nomor telepon saja*\n4. Masukkan kode di atas\n\n_Waktu Anda 30 detik sebelum kode kedaluwarsa._`;
                            await this.parentConn.sendMessage(this.targetChat, { text: tutor }, { quoted: this.quotedMsg });
                        }
                    } catch (e) {
                        console.error(`[JadiBot ${this.sessionName}] Pairing error:`, e.message);
                    }
                }
            } else if (this.mode === 'scan') {
                if (!s.qrSent && this.parentConn && this.targetChat) {
                    s.qrSent = true;
                    try {
                        const qrBuffer = await QRCode.toBuffer(qr, { type: 'png', margin: 2, scale: 5 });
                        await this.parentConn.sendMessage(this.targetChat, {
                            image: qrBuffer,
                            mimetype: 'image/png',
                            caption: `📱 *QR SCAN JADIBOT*\n\nSilakan scan QR di atas melalui WhatsApp > Perangkat Tertaut.\n_QR berlaku selama 30 detik._`
                        }, { quoted: this.quotedMsg });
                    } catch (e) {
                        console.error(`[JadiBot ${this.sessionName}] QR error:`, e.message);
                    }
                }
            }
        });

        // Anti-Call Handler on Sub-Bot
        this.conn.on('call', async (callEvent) => {
            const subSettings = this.getSettings();
            if (!subSettings.antiCall) return;

            const callerJid = callEvent.callerPnJid || callEvent.callCreatorJid || callEvent.from || '';
            const botNum = this.getBotNumber();
            if (!callerJid || (global.isOwner && global.isOwner(callerJid)) || (botNum && callerJid.includes(botNum))) return;

            // Dedupe: 1 panggilan memancarkan banyak event call → hanya proses OFFER pertama
            const gate = evaluateAntiCall(callEvent, callerJid);
            if (!gate.handle) return;

            console.log(`[JadiBot Anti-Call ${this.sessionName}] Menolak panggilan dari: ${callerJid} (type: ${callEvent.type || 'unknown'})`);
            try {
                if (this.conn.lowLevel?.sendNode && callEvent.callId) {
                    await this.conn.lowLevel.sendNode({
                        tag: 'call',
                        attrs: { to: callerJid, id: callEvent.callId },
                        content: [{
                            tag: 'reject',
                            attrs: {
                                'call-id': callEvent.callId,
                                'call-creator': callEvent.callCreatorJid || callerJid,
                                count: '0'
                            }
                        }]
                    }).catch(() => {});
                }

                // Jika panggilan dari grup (group call), cukup reject saja tanpa ban & tanpa pesan
                const isGroupCall = (callEvent.chatId || callEvent.from || '').endsWith('@g.us');
                if (!isGroupCall) {
                    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
                    const now = Date.now();

                    if (!global.db.data.users) global.db.data.users = {};
                    const existingUser = global.db.data.users[callerJid];

                    // Akumulatif: jika sudah banned dan masih ada sisa waktu, tambahkan 30 hari dari expiry sebelumnya
                    const currentExpiry = (existingUser?.banned && existingUser?.bannedExpiry && existingUser.bannedExpiry > now)
                        ? existingUser.bannedExpiry
                        : now;
                    const expiryTime = currentExpiry + thirtyDaysMs;
                    const wasAlreadyBanned = Boolean(existingUser?.banned && existingUser?.bannedExpiry && existingUser.bannedExpiry > now);

                    if (!existingUser) {
                        global.db.data.users[callerJid] = {
                            name: callerJid.split('@')[0],
                            exp: 0,
                            level: 1,
                            banned: true,
                            bannedExpiry: expiryTime,
                            bannedReason: 'Call JadiBot'
                        };
                    } else {
                        existingUser.banned = true;
                        existingUser.bannedExpiry = expiryTime;
                        existingUser.bannedReason = 'Call JadiBot';
                    }
                    global.db.scheduleSave();

                    if (gate.notify) {
                        const expDateStr = new Date(expiryTime).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                        });
                        const sisaHariTotal = Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000));
                        const tambahMsg = wasAlreadyBanned
                            ? `⚠️ Anda menelepon lagi saat status banned masih aktif! Hukuman banned ditambah *+30 Hari* lagi (Total sisa: *${sisaHariTotal} Hari* hingga *${expDateStr}*).`
                            : `Akun Anda otomatis di-banned selama *30 Hari* (hingga *${expDateStr}*).`;

                        await this.conn.sendMessage(callerJid, {
                            text: `⚠️ *ANTI-CALL AKTIF!*\n\nMaaf, bot tidak menerima panggilan telepon ataupun video.\n${tambahMsg}\n\nSetelah masa banned selesai, akun Anda akan otomatis di-unban oleh sistem.`
                        }).catch(() => {});
                    }
                }
            } catch (e) {}
        });

        // Incoming Messages on Sub-Bot: Process with Plugins!
        this.conn.on('message', async (event) => {
            const rawMsg = event.raw || event;
            if (!rawMsg.message) return;

            let m;
            try {
                m = await smsg(this.conn, event);
            } catch (e) {
                console.error(`[JadiBot ${this.sessionName}] smsg error:`, e);
                m = rawMsg;
            }

            // Sync sender pushName ke bot identity jika pesan dikirim dari akun sub-bot itu sendiri
            if (rawMsg.key?.fromMe && m.pushName && m.pushName.trim()) {
                persistIdentity(this.getBotJid(), m.pushName);
            }

            const cleanText = m.cleanText || (m.text || '').trim();
            const from = m.chat || rawMsg.key.remoteJidAlt || rawMsg.key.remoteJid;
            const quotedMsg = { ...rawMsg, key: { ...rawMsg.key, remoteJid: from } };

            const reply = m.reply || (async (t, opt = {}) => {
                return this.conn.sendMessage(from, typeof t === 'string' ? { text: t } : t, { quoted: quotedMsg, ...opt });
            });

            const botNum = this.getBotNumber();
            const isOwner = rawMsg.key.fromMe ||
                            m.isOwner ||
                            (global.isOwner && global.isOwner(m.sender)) ||
                            (botNum && m.sender.includes(botNum));

            // Setting Mode Khusus Sub-bot (Self / Public / Group)
            const subSettings = this.getSettings();

            // Auto-Read Message jika sub-bot mengaktifkan autoread
            if (subSettings.autoReadMessage && !rawMsg.key.fromMe && rawMsg.key.id && m.chat !== 'status@broadcast') {
                try {
                    const participant = m.isGroup ? (rawMsg.key.participant || m.sender) : undefined;
                    await this.conn.message.sendReceipt(m.chat, [rawMsg.key.id], {
                        participant,
                        type: 'read'
                    }).catch(() => {});
                } catch (e) {}
            }

            if (!isOwner) {
                if (!subSettings.publicMode) return;
                if (m.isGroup && !subSettings.groupMode) return;
            }

            // Dispatch to Plugin System
            await handlePluginMessage(m, {
                client: this.conn,
                from,
                quotedMsg,
                cleanText,
                senderJid: m.sender || rawMsg.key.participant || from,
                realPhone: m.realPhone || m.senderNumber,
                isOwner,
                reply
            });
        });

        this.conn.connect().catch(() => {});
        return this.conn;
    }

    async disconnect(isCleanFiles = false) {
        if (this.isDestroyed) return;
        this.isDestroyed = true;
        this.stopWatcher();

        jadibotConns.delete(this.sessionName);
        sessionCache.delete(this.sessionName);

        try {
            if (this.conn) {
                this.conn.removeAllListeners();
                await this.conn.disconnect?.('loggedOut', null).catch(() => {});
            }
        } catch (e) {}

        if (isCleanFiles && fs.existsSync(this.sessionFolder)) {
            try {
                fs.rmSync(this.sessionFolder, { recursive: true, force: true });
            } catch (e) {}
        }
    }
}

/**
 * Initiates a new Jadibot session with auto-expiry timeout (30s)
 */
export async function createJadiBotSession(parentConn, msg, targetNumber, mode = 'pairing') {
    const cleanNumber = String(targetNumber).replace(/[^0-9]/g, '');
    const sessionName = cleanNumber;

    if (jadibotConns.has(sessionName)) {
        const existing = jadibotConns.get(sessionName);
        if (existing?.conn?.user?.id) {
            return parentConn.sendMessage(msg.key.remoteJid, {
                text: `✅ Sesi jadibot untuk nomor *+${cleanNumber}* sudah aktif.\nKetik *.stopjadibot ${cleanNumber}* untuk mematikan.`
            }, { quoted: msg });
        }
        await existing.disconnect(true);
    }

    const sessionData = {
        isLoggedIn: false,
        isTerminated: false,
        codeSent: false,
        qrSent: false,
        timeoutTimer: null
    };
    sessionCache.set(sessionName, sessionData);

    const instance = new JadiBotConnection(sessionName, { number: cleanNumber });
    instance.mode = mode;
    instance.parentConn = parentConn;
    instance.targetChat = msg.key.remoteJidAlt || msg.key.remoteJid;
    instance.quotedMsg = msg;

    await instance.start();

    // 30 Seconds Timeout if not paired
    sessionData.timeoutTimer = setTimeout(async () => {
        if (!sessionData.isLoggedIn && !instance.conn?._botJid) {
            sessionData.isTerminated = true;
            console.log(`[JadiBot ${sessionName}] ⏳ Waktu habis (30 detik). Sesi dibatalkan.`);
            await parentConn.sendMessage(instance.targetChat, {
                text: `❌ Waktu pairing/scan untuk *+${cleanNumber}* telah habis (30 detik). Sesi dibatalkan.`
            }, { quoted: msg }).catch(() => {});
            await instance.disconnect(true);
        }
    }, 35000);

    return instance;
}

export async function stopJadiBot(targetNumber, isDelete = true) {
    const cleanNumber = String(targetNumber).replace(/[^0-9]/g, '');
    let stopped = false;

    if (jadibotConns.has(cleanNumber)) {
        const inst = jadibotConns.get(cleanNumber);
        await inst.disconnect(isDelete);
        stopped = true;
    }

    if (isDelete) {
        const sessionPath = path.join(SESSIONS_DIR, cleanNumber);
        if (fs.existsSync(sessionPath)) {
            try {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                stopped = true;
            } catch (e) {}
        }
    }

    return stopped;
}

export async function startJadiBot(targetNumber) {
    const cleanNumber = String(targetNumber).replace(/[^0-9]/g, '');
    if (!cleanNumber) return false;

    if (jadibotConns.has(cleanNumber)) {
        const existing = jadibotConns.get(cleanNumber);
        if (existing.conn && !existing.isDestroyed) return true;
        await existing.disconnect(false);
    }

    const sessionPath = path.join(SESSIONS_DIR, cleanNumber);
    const hasSqlite = fs.existsSync(path.join(sessionPath, 'state.sqlite'));
    if (!hasSqlite) return false;

    const inst = new JadiBotConnection(cleanNumber, { number: cleanNumber });
    await inst.start();
    return true;
}

export function getJadibotSettingsByNumber(cleanNumber) {
    if (jadibotConns.has(cleanNumber)) {
        return jadibotConns.get(cleanNumber).getSettings();
    }
    const settingsPath = path.join(SESSIONS_DIR, cleanNumber, 'settings.json');
    if (fs.existsSync(settingsPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            return {
                publicMode: typeof data.publicMode === 'boolean' ? data.publicMode : true,
                groupMode: typeof data.groupMode === 'boolean' ? data.groupMode : true,
                autoReadStatus: typeof data.autoReadStatus === 'boolean' ? data.autoReadStatus : false,
                autoReadMessage: typeof data.autoReadMessage === 'boolean' ? data.autoReadMessage : false,
                antiCall: typeof data.antiCall === 'boolean' ? data.antiCall : false
            };
        } catch (e) {}
    }
    return { publicMode: true, groupMode: true, autoReadStatus: false, autoReadMessage: false, antiCall: false };
}

export function updateJadibotSettingsByNumber(cleanNumber, newSettings = {}) {
    if (jadibotConns.has(cleanNumber)) {
        return jadibotConns.get(cleanNumber).updateSettings(newSettings);
    }
    const sessionDir = path.join(SESSIONS_DIR, cleanNumber);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    const settingsPath = path.join(sessionDir, 'settings.json');
    let data = getJadibotSettingsByNumber(cleanNumber);
    data = { ...data, ...newSettings };
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
    return data;
}

export function listJadiBot() {
    const list = [];
    const activeMap = new Map();

    for (const [name, inst] of jadibotConns.entries()) {
        const num = inst.getBotNumber();
        const jid = inst.getBotJid();
        const isOnline = Boolean(inst.conn && !inst.isDestroyed);
        const displayName = inst.getDisplayName();
        const settings = inst.getSettings();

        const item = {
            sessionName: name,
            number: num || name,
            jid,
            name: displayName,
            isOnline,
            hasSession: true,
            settings
        };
        list.push(item);
        activeMap.set(name, item);
    }

    // Scan sessions folder untuk sesi tersimpan yang sedang offline (dimatikan)
    if (fs.existsSync(SESSIONS_DIR)) {
        try {
            const entries = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
                    if (!activeMap.has(entry.name)) {
                        const sPath = path.join(SESSIONS_DIR, entry.name);
                        const hasSqlite = fs.existsSync(path.join(sPath, 'state.sqlite'));
                        if (hasSqlite) {
                            let displayName = 'User';
                            try {
                                const db = new Database(path.join(sPath, 'state.sqlite'), { readonly: true });
                                const row = db.prepare("SELECT value FROM metadata WHERE key = 'me_display_name'").get();
                                if (row?.value) displayName = String(row.value);
                                db.close();
                            } catch (e) {}

                            list.push({
                                sessionName: entry.name,
                                number: entry.name,
                                jid: `${entry.name}@s.whatsapp.net`,
                                name: displayName,
                                isOnline: false,
                                hasSession: true,
                                settings: getJadibotSettingsByNumber(entry.name)
                            });
                        }
                    }
                }
            }
        } catch (e) {}
    }

    return list;
}

/**
 * Restores all saved Jadibot sessions on startup
 */
export async function restoreClonedSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    try {
        console.log('\n🔄 [JADIBOT] Memindai artefak sesi lokal untuk restorasi...');
        const entries = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const sName = entry.name;
                if (!/^\d+$/.test(sName)) continue;
                if (jadibotConns.has(sName)) continue;

                const sessionPath = path.join(SESSIONS_DIR, sName);
                const hasSqlite = fs.existsSync(path.join(sessionPath, 'state.sqlite'));

                if (hasSqlite) {
                    try {
                        console.log(`[JADIBOT] ⚙️ Memulihkan sesi kloning: ${sName}`);
                        const inst = new JadiBotConnection(sName, { number: sName });
                        await inst.start();
                        await new Promise((r) => setTimeout(r, 2000));
                    } catch (err) {
                        console.error(`[JADIBOT] Gagal restore sesi ${sName}:`, err.message);
                    }
                }
            }
        }
        console.log('✅ [JADIBOT] Seluruh sesi kloning telah selesai direstorasi.\n');
    } catch (e) {
        console.error('[JADIBOT] Error restorasi:', e.message);
    }
}
