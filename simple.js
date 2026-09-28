import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { unwrapMessage, getContentType, downloadMediaMessage, proto } from 'zapo-js';
import { resolvePhoneNumberFromMsg, saveLidPhoneMapping, resolvePhoneNumberFromLid } from './lib/lid_helper.js';

export const jidNormalizedUser = (jid) => {
    if (!jid) return '';
    return String(jid).replace(/:\d+@/, '@');
};

export const areJidsSameUser = (a, b) => jidNormalizedUser(a) === jidNormalizedUser(b);

/**
 * Loads a full message object (including pushName and metadata) by ID from disk cache or SQLite
 */
export function loadRawMessageById(id, authDir = 'session_auth') {
    if (!id) return null;

    // 1. Check disk JSON cache
    const diskPath = path.join('./message-cache', `${id}.json`);
    if (fs.existsSync(diskPath)) {
        try {
            return JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        } catch (e) {}
    }

    // 2. Check SQLite mailbox_messages table
    const sqlitePath = path.join('.', `zapo-${authDir}.sqlite`);
    if (fs.existsSync(sqlitePath)) {
        try {
            const db = new Database(sqlitePath, { readonly: true });
            const row = db.prepare('SELECT message_bytes, sender_jid, participant_jid FROM mailbox_messages WHERE message_id = ?').get(id);
            db.close();
            if (row?.message_bytes) {
                const decoded = proto.Message.decode(row.message_bytes);
                return {
                    key: { id, participant: row.participant_jid || row.sender_jid },
                    message: restoreMediaBuffers(decoded)
                };
            }
        } catch (e) {}
    }

    return null;
}

/**
 * Loads a message payload by ID from disk cache or SQLite mailbox_messages
 */
export function loadMessageById(id, authDir = 'session_auth') {
    const raw = loadRawMessageById(id, authDir);
    return raw?.message ? restoreMediaBuffers(raw.message) : null;
}

/**
 * Restores binary byte arrays and Long objects from JSON-cached message objects
 */
export function restoreMediaBuffers(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) return obj;

    const binaryFields = ['mediaKey', 'fileSha256', 'fileEncSha256', 'jpegThumbnail', 'scansSidecar', 'midQualityFileSha256'];

    if (obj.fileLength && typeof obj.fileLength === 'object') {
        obj.fileLength = Number(obj.fileLength.low !== undefined ? obj.fileLength.low : obj.fileLength);
    }
    if (obj.mediaKeyTimestamp && typeof obj.mediaKeyTimestamp === 'object') {
        obj.mediaKeyTimestamp = Number(obj.mediaKeyTimestamp.low !== undefined ? obj.mediaKeyTimestamp.low : obj.mediaKeyTimestamp);
    }

    for (const key in obj) {
        if (binaryFields.includes(key)) {
            const val = obj[key];
            if (val && typeof val === 'object' && !(val instanceof Uint8Array)) {
                if (val.type === 'Buffer' && Array.isArray(val.data)) {
                    obj[key] = Buffer.from(val.data);
                } else {
                    const bytes = Object.values(val);
                    obj[key] = Buffer.from(bytes);
                }
            }
        } else if (typeof obj[key] === 'object') {
            obj[key] = restoreMediaBuffers(obj[key]);
        }
    }
    return obj;
}

/**
 * Downloads media from any message object (Buffer return)
 */
export async function downloadMedia(targetMsg) {
    if (!targetMsg) throw new Error('No message provided for download');
    let unwrapped = unwrapMessage(targetMsg.message || targetMsg) || targetMsg;
    unwrapped = restoreMediaBuffers(unwrapped);
    const stream = await downloadMediaMessage(unwrapped);
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/**
 * Serializes raw WhatsApp event/message into a clean `m` object
 */
export async function smsg(client, rawEvent) {
    if (!rawEvent || typeof rawEvent !== 'object') return rawEvent;
    if (rawEvent._isSerialized) return rawEvent;

    const m = { ...rawEvent, _isSerialized: true };
    const rawMsg = rawEvent.raw || rawEvent;

    m.key = rawMsg.key || {};
    m.id = m.key.id || '';
    m.chat = jidNormalizedUser(m.key.remoteJid || '');
    m.isGroup = m.chat.endsWith('@g.us');

    // Resolusi Sender
    const p1 = m.key.participant || m.key.remoteJid || '';
    const p2 = m.key.participantAlt || m.key.remoteJidAlt || rawMsg.rawNode?.attrs?.participant_pn || '';

    // Catat pemetaan LID ke nomor telepon
    if (p1.includes('@lid') && p2.includes('@s.whatsapp.net')) {
        saveLidPhoneMapping(p1, p2);
    } else if (p2.includes('@lid') && p1.includes('@s.whatsapp.net')) {
        saveLidPhoneMapping(p2, p1);
    }

    let realSender = '';
    if (p2.includes('@s.whatsapp.net')) realSender = p2;
    else if (p1.includes('@s.whatsapp.net')) realSender = p1;
    else if (p1.includes('@lid')) {
        const mappedPn = resolvePhoneNumberFromLid(p1);
        if (mappedPn) realSender = `${mappedPn}@s.whatsapp.net`;
        else realSender = p1;
    } else {
        realSender = p1;
    }

    m.sender = jidNormalizedUser(realSender);
    m.senderNumber = m.sender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

    // Resolusi Phone Asli & Owner
    const realPhone = resolvePhoneNumberFromMsg(rawMsg, client) || m.senderNumber;
    m.realPhone = realPhone;
    if (m.sender.includes('@lid') && realPhone && !realPhone.startsWith('1507') && realPhone.length >= 10 && realPhone.length <= 15) {
        m.sender = `${realPhone}@s.whatsapp.net`;
        m.senderNumber = realPhone;
    }

    const botPn = (client.user?.id || client.user?.jid || client._botJid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

    m.isOwner = m.key.fromMe ||
                (global.isOwner && (global.isOwner(m.sender) || global.isOwner(realPhone))) ||
                (botPn && (m.sender.includes(botPn) || realPhone === botPn));

    m.pushName = rawMsg.pushName || '';
    m.name = m.pushName || (m.isOwner ? 'Owner' : m.senderNumber || 'User');

    // ─── Auto Init Global DB ──────────────────────────────────────────────
    if (global.db?.data) {
        if (!global.db.data.users) global.db.data.users = {};
        if (!global.db.data.chats) global.db.data.chats = {};

        // Inisialisasi User (Validasi ketat: hanya nomor telepon asli WhatsApp)
        const isLidSender = m.sender.includes('@lid') || 
                            m.sender.endsWith('@newsletter') || 
                            m.sender.endsWith('@g.us') || 
                            m.sender.endsWith('@hosted') || 
                            m.sender.endsWith('@bot') ||
                            !m.sender.endsWith('@s.whatsapp.net') ||
                            m.senderNumber.length < 9 ||
                            (m.senderNumber.length >= 14 && !m.senderNumber.startsWith('62'));

        if (m.sender && !isLidSender) {
            if (!global.db.data.users[m.sender] || typeof global.db.data.users[m.sender] !== 'object') {
                global.db.data.users[m.sender] = {
                    name: m.name,
                    limit: 20,
                    exp: 0,
                    level: 1,
                    premium: false,
                    premiumTime: 0,
                    afk: -1,
                    afkReason: '',
                    banned: false
                };
            } else {
                if (m.pushName) global.db.data.users[m.sender].name = m.pushName;
                if (global.db.data.users[m.sender].limit === undefined) global.db.data.users[m.sender].limit = 20;
            }
        }

        // Inisialisasi Chat / Grup (Hanya untuk grup @g.us)
        if (m.chat && m.isGroup) {
            if (!global.db.data.chats[m.chat] || typeof global.db.data.chats[m.chat] !== 'object') {
                global.db.data.chats[m.chat] = {
                    isBanned: false,
                    welcome: true,
                    mute: false,
                    antiLink: false
                };
            }
        }
    }

    // Message Content Unwrapping
    let message = rawMsg.message || null;
    if (message && typeof message === 'object') {
        let mtype = getContentType(message);
        while (['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage'].includes(mtype) && message[mtype]?.message) {
            message = message[mtype].message;
            mtype = getContentType(message);
        }
        m.message = message;
        m.mtype = mtype;
        m.msg = (mtype && message) ? message[mtype] : message;
    } else {
        m.message = null;
        m.mtype = null;
        m.msg = null;
    }

    // Text Extraction
    m.text = m.msg?.conversation ||
             m.msg?.text ||
             (typeof m.msg === 'string' ? m.msg : '') ||
             m.msg?.caption ||
             m.msg?.selectedId ||
             m.msg?.selectedButtonId ||
             m.msg?.singleSelectReply?.selectedRowId ||
             '';
    m.cleanText = m.text.trim();

    // Mentioned JIDs
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];

    // ─── Quoted Message Handling ──────────────────────────────────────────
    const contextInfo = m.msg?.contextInfo || rawMsg.message?.extendedTextMessage?.contextInfo;
    let quotedRaw = contextInfo?.quotedMessage;

    if (quotedRaw && typeof quotedRaw === 'object') {
        let qtype = getContentType(quotedRaw);
        while (['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage'].includes(qtype) && quotedRaw[qtype]?.message) {
            quotedRaw = quotedRaw[qtype].message;
            qtype = getContentType(quotedRaw);
        }

        const qSender = contextInfo.participant || contextInfo.remoteJid || '';
        let qSenderNorm = jidNormalizedUser(qSender);

        let qPushName = contextInfo.pushName || '';
        if (contextInfo.stanzaId) {
            const cachedQuoted = loadRawMessageById(contextInfo.stanzaId);
            if (cachedQuoted) {
                if (!qPushName) {
                    qPushName = cachedQuoted.pushName || cachedQuoted.rawNode?.attrs?.notify || '';
                }
                const pn = cachedQuoted.key?.participantAlt || cachedQuoted.rawNode?.attrs?.participant_pn;
                if (pn && !pn.includes('@lid')) {
                    qSenderNorm = jidNormalizedUser(pn);
                    saveLidPhoneMapping(qSender, pn);
                }
            }
        }

        // Resolusi mapping jika qSender masih LID
        if (qSenderNorm.includes('@lid')) {
            const mappedPn = resolvePhoneNumberFromLid(qSenderNorm);
            if (mappedPn) {
                qSenderNorm = `${mappedPn}@s.whatsapp.net`;
            }
        }

        if (!qPushName && global.db?.data?.users?.[qSenderNorm]?.name) {
            qPushName = global.db.data.users[qSenderNorm].name;
        }

        const qSenderNum = qSenderNorm.split('@')[0].replace(/[^0-9]/g, '');
        const qDisplayName = qPushName || (!qSenderNorm.includes('@lid') ? `+${qSenderNum}` : 'User');

        m.quoted = {
            key: {
                remoteJid: m.chat,
                id: contextInfo.stanzaId || '',
                participant: qSenderNorm || undefined,
                fromMe: qSenderNorm === jidNormalizedUser(client.user?.id || '')
            },
            id: contextInfo.stanzaId || '',
            sender: qSenderNorm,
            senderNumber: qSenderNum,
            pushName: qPushName,
            name: qDisplayName,
            message: quotedRaw,
            mtype: qtype,
            msg: quotedRaw[qtype] || quotedRaw,
            text: quotedRaw[qtype]?.text || quotedRaw[qtype]?.caption || quotedRaw[qtype]?.conversation || (typeof quotedRaw[qtype] === 'string' ? quotedRaw[qtype] : '') || '',
            download: async () => downloadMedia(quotedRaw)
        };
    } else {
        m.quoted = null;
    }

    // ─── Helper Functions ──────────────────────────────────────────────────
    if (client && !client.reply) {
        client.reply = async (jid, content, quoted, options = {}) => {
            const payload = typeof content === 'string' ? { text: content } : content;
            const sendOpts = quoted !== undefined ? { quoted, ...options } : options;
            return await client.sendMessage(jid, payload, sendOpts);
        };
    }

    m.reply = async (content, options = {}) => {
        const targetChat = options.chat || m.chat;
        const quotedKey = options.quoted !== undefined ? options.quoted : { key: m.key };
        return await client.reply(targetChat, content, quotedKey, options);
    };

    m.react = async (emoji) => {
        return await client.sendMessage(m.chat, {
            reactionMessage: {
                key: m.key,
                text: emoji
            }
        });
    };

    m.download = async () => {
        if (!m.message) throw new Error('No media message to download');
        return await downloadMedia(m.message);
    };

    return m;
}
