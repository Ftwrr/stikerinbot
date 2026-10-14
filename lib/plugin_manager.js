import './config.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { isFreeLimitChat } from './settings.js';

let _pluginCache = [];
let _pluginMap = new Map();
let _customHandlers = [];
const PLUGINS_DIR = path.join(process.cwd(), 'plugins');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PC_DELAY_MS = process.env.PC_DELAY_MS ? parseInt(process.env.PC_DELAY_MS, 10) : 5000; // 5 Detik

// Anti-Spam Queue / Promise Chain per user
const userQueueMap = new Map();
const COMMAND_COOLDOWN_MS = process.env.COMMAND_COOLDOWN_MS ? parseInt(process.env.COMMAND_COOLDOWN_MS, 10) : 1500; // 1.5 detik jarak antrean antar command per user

export const loadPlugins = async (dir = PLUGINS_DIR, isSub = false) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return [];
    }

    if (!isSub) {
        _pluginCache = [];
        _pluginMap.clear();
        _customHandlers = [];
    }

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            await loadPlugins(filePath, true);
        } else if (file.endsWith('.js') && !file.startsWith('_') && !file.startsWith('.')) {
            let tmpFile = null;
            try {
                // Untuk kompatibilitas reload modul di Bun & Node
                const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                tmpFile = path.join(dir, `._tmp_${uniqueId}_${file}`);
                fs.copyFileSync(filePath, tmpFile);

                const module = await import(pathToFileURL(tmpFile).href);
                const plugin = module.default || module;

                if (typeof plugin === 'function') {
                    plugin.filePath = filePath;
                    plugin.relPath = path.relative(PLUGINS_DIR, filePath);
                    _pluginCache.push(plugin);

                    if (Array.isArray(plugin.command)) {
                        for (const cmd of plugin.command) {
                            _pluginMap.set(cmd.toLowerCase(), plugin);
                        }
                    } else if (plugin.custom) {
                        _customHandlers.push(plugin);
                    }
                }
            } catch (err) {
                console.error(`[Plugin] Gagal load '${filePath}':`, err.message);
            } finally {
                if (tmpFile && fs.existsSync(tmpFile)) {
                    try { fs.unlinkSync(tmpFile); } catch (e) {}
                }
            }
        }
    }

    if (!isSub) {
        console.log(`[Plugin] ✅ Berhasil memuat ${_pluginCache.length} plugins (${_pluginMap.size} commands)`);
    }
    return _pluginCache;
};

export const getLoadedPlugins = () => _pluginCache;

// ─── Watcher Hot Reload ────────────────────────────────────────────────────────
const watchedDirs = new Set();
let debounceTimer = null;

const watchDir = (dir) => {
    if (watchedDirs.has(dir) || !fs.existsSync(dir)) return;
    watchedDirs.add(dir);

    fs.watch(dir, { persistent: true }, (eventType, filename) => {
        // Abaikan file temporary, dotfiles, dan hidden files agar tidak terjadi infinite reload loop
        if (!filename || !filename.endsWith('.js') || filename.startsWith('.') || filename.startsWith('_')) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            console.log(`[Plugin Watcher] 🔄 Perubahan file: ${filename}, me-reload plugins...`);
            try {
                await loadPlugins();
                watchAllDirs(PLUGINS_DIR);
            } catch (e) {
                console.error('[Plugin Watcher] Gagal reload:', e.message);
            }
        }, 500);
    });
};

const watchAllDirs = (baseDir) => {
    if (!fs.existsSync(baseDir)) return;
    watchDir(baseDir);
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            watchAllDirs(path.join(baseDir, entry.name));
        }
    }
};

export const startPluginWatcher = () => {
    watchAllDirs(PLUGINS_DIR);
};

// ─── Dispatcher ────────────────────────────────────────────────────────────────
export const handlePluginMessage = async (m, extra) => {
    const text = m.cleanText || m.text || extra.cleanText || '';
    if (!text) return false;

    const fullExtra = {
        ...extra,
        conn: extra.client,
        getPlugins: () => _pluginCache
    };

    // 1. Command handler (misal: .menu, . brat, / s, ! ai, $ ls)
    const match = text.match(/^([\.\/\!\#\$])\s*(\w+)(?:\s+(.*))?$/s);
    if (match) {
        const usedPrefix = match[1];
        const cmdName = match[2].toLowerCase();
        const textParam = (match[3] || '').trim();
        const plugin = _pluginMap.get(cmdName);

        if (plugin) {
            const isOwner = m.isOwner !== undefined ? m.isOwner : extra.isOwner;
            const user = global.db?.data?.users?.[m.sender];
            const isPremium = isOwner || Boolean(user?.premium || (user?.premiumTime && user.premiumTime > Date.now()));

            // ─── BANNED GUARD (Kecuali Owner & Command unban/qris) ───────────
            if (user?.banned && !isOwner && !['unban', 'qris', 'cekqris', 'cekkpr'].includes(cmdName)) {
                let bannedInfo = '🚫 *AKUN DIBANNED!*\n\nAkun Anda sedang dalam status banned.';
                if (user.bannedExpiry && user.bannedExpiry > Date.now()) {
                    const sisaHari = Math.ceil((user.bannedExpiry - Date.now()) / (24 * 60 * 60 * 1000));
                    const expDateStr = new Date(user.bannedExpiry).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                    });
                    bannedInfo += `\n⏳ *Sisa Hukuman:* ${sisaHari} Hari lagi (hingga ${expDateStr}).\nAkun akan otomatis dibuka setelah masa banned selesai.`;
                }
                bannedInfo += `\n\n💡 *Mau cepat buka banned tanpa menunggu?*\nKetik *.unban* untuk membuka banned instan via QRIS (Rp 2.000).`;

                const buttons = [{ id: '.unban', text: '🔓 Buka Banned (QRIS)' }];
                if (m.sendButtons) {
                    await m.sendButtons(bannedInfo, buttons, 'Stikerin Bot • Akun Banned');
                } else if (extra.client?.sendButtons) {
                    await extra.client.sendButtons(m.chat, bannedInfo, buttons, 'Stikerin Bot • Akun Banned', { key: m.key });
                } else {
                    await (m.reply ? m.reply(bannedInfo) : extra.reply(bannedInfo));
                }
                return true;
            }

            // ─── CHAT MUTE GUARD (Kecuali Owner) ────────────────────────────
            const chatData = global.db?.data?.chats?.[m.chat];
            if (chatData?.isMuted && !isOwner) {
                // Saat chat di-mute, bot senyap total terhadap perintah dari non-owner
                return true;
            }

            // ─── ANTI-SPAM QUEUE SEQUENTIAL RUNNER (Kecuali Owner) ───────────
            if (!isOwner) {
                const prevPromise = userQueueMap.get(m.sender) || Promise.resolve();
                const currentTask = prevPromise
                    .catch(() => {})
                    .then(async () => {
                        await delay(COMMAND_COOLDOWN_MS);
                        return executePlugin(m, plugin, cmdName, textParam, usedPrefix, fullExtra, isOwner, isPremium, user);
                    });

                userQueueMap.set(m.sender, currentTask);
                // Bersihkan queue setelah selesai
                currentTask.finally(() => {
                    if (userQueueMap.get(m.sender) === currentTask) {
                        userQueueMap.delete(m.sender);
                    }
                });

                return await currentTask;
            }

            return await executePlugin(m, plugin, cmdName, textParam, usedPrefix, fullExtra, isOwner, isPremium, user);
        }
    }

    // 2. Custom handlers (Auto downloader url, eval, dll)
    for (const customPlugin of _customHandlers) {
        try {
            const handled = await customPlugin(m, fullExtra);
            if (handled) return true;
        } catch (err) {
            console.error('[Custom Plugin Error]', err);
        }
    }

    return false;
};

/**
 * Eksekusi plugin dengan permission & limit guard
 */
async function executePlugin(m, plugin, cmdName, textParam, usedPrefix, fullExtra, isOwner, isPremium, user) {
    // 1. Owner Only
    if (plugin.owner && !isOwner) {
        await (m.reply ? m.reply('⛔ Perintah ini hanya untuk Owner bot!') : fullExtra.reply('⛔ Perintah ini hanya untuk Owner bot!'));
        return true;
    }

    // 2. Premium Only
    if (plugin.premium && !isPremium) {
        await (m.reply ? m.reply('👑 Fitur ini khusus pengguna *Premium*!\nKetik *.premium* untuk info langganan (Rp 7k/bln).') : fullExtra.reply('👑 Fitur ini khusus pengguna *Premium*!'));
        return true;
    }

    // 3. Group Only
    if (plugin.group && !m.isGroup) {
        await (m.reply ? m.reply('👥 Perintah ini hanya dapat digunakan di dalam grup!') : fullExtra.reply('👥 Perintah ini hanya dapat digunakan di dalam grup!'));
        return true;
    }

    // 3b. Group Admin Only
    if (plugin.admin && m.isGroup && !isOwner) {
        const isAdmin = m.isAdmin || false;
        if (!isAdmin) {
            await (m.reply ? m.reply('⛔ Perintah ini hanya dapat digunakan oleh Admin grup!') : fullExtra.reply('⛔ Perintah ini hanya dapat digunakan oleh Admin grup!'));
            return true;
        }
    }

    // 4. Private Chat Only
    if (plugin.private && m.isGroup) {
        await (m.reply ? m.reply('🔒 Perintah ini hanya dapat digunakan di chat pribadi (DM/PC)!') : fullExtra.reply('🔒 Perintah ini hanya dapat digunakan di chat pribadi (DM/PC)!'));
        return true;
    }

    // ─── DELAY SEBELUM PROSES (Khusus Free User di Chat Pribadi) ───
    const skipDelay = plugin.delay === false || m.isGroup || isPremium || m.isOwner;
    if (!skipDelay) {
        const delayMs = typeof plugin.delay === 'number' ? plugin.delay * 1000 : PC_DELAY_MS;
        await delay(delayMs);
    }

    // ─── PENGURANGAN LIMIT (Kecuali Owner, Premium, atau di Grup Resmi Stikerin/Sewa) ───
    const isFreeGroup = isFreeLimitChat(m);
    if (user && !isPremium && !isFreeGroup) {
        const limitCost = typeof plugin.limit === 'number' ? plugin.limit : (plugin.limit === false ? 0 : 1);
        if (limitCost > 0) {
            if ((user.limit || 0) < limitCost) {
                const noLimitMsg = `⚠️ *Limit Kamu Habis!*

💡 *Gratis pakai bot di grup tanpa batas limit!* Silakan gabung ke grup resmi kami:
👉 Grup 1: https://chat.whatsapp.com/FuE56R4VMclGufccHN9RCz
👉 Grup 2: https://chat.whatsapp.com/Bek3XeV1a432DMf4xuenRU

*Cara lain tambah limit:*
• Ketik *.claim* (gratis limit harian)
• Ketik *.buylimit <jumlah>* (tukar EXP game jadi limit)
• Ketik *.premium* (unlimited di private chat)`;
                const buttons = [
                    { id: '.claim', text: '🎁 Klaim Limit' },
                    { id: '.premium', text: '👑 Beli Premium' }
                ];
                if (m.sendButtons) {
                    await m.sendButtons(noLimitMsg, buttons, 'Stikerin Bot • Limit Habis');
                } else if (fullExtra.conn?.sendButtons) {
                    await fullExtra.conn.sendButtons(m.chat, noLimitMsg, buttons, 'Stikerin Bot • Limit Habis', { key: m.key });
                } else {
                    await (m.reply ? m.reply(noLimitMsg) : fullExtra.reply(noLimitMsg));
                }
                return true;
            }
            user.limit -= limitCost;
        }
    }

    try {
        await plugin(m, {
            ...fullExtra,
            command: cmdName,
            text: textParam,
            args: textParam.split(' ').filter(Boolean),
            usedPrefix,
            isOwner,
            isPremium
        });

        // ─── REWARD EXP RANDOM 1-9 & LEVEL UP CHECK ───────────────────
        if (user) {
            const gainedExp = Math.floor(Math.random() * 9) + 1;
            user.exp = (user.exp || 0) + gainedExp;

            const currentLevel = user.level || 1;
            const neededExp = currentLevel * 1000;
            if (user.exp >= neededExp) {
                user.level = currentLevel + 1;
                user.limit = (user.limit || 0) + 5;
                global.db?.scheduleSave();

                const levelUpMsg = `🆙 *LEVEL UP!* 🆙\n\nSelamat *@${m.sender.split('@')[0]}*, kamu naik ke *Level ${user.level}*!\n🎁 Bonus: *+5 Limit*\n⚡ EXP Sekarang: *${user.exp.toLocaleString('id-ID')} EXP*`;
                await (m.reply ? m.reply(levelUpMsg) : fullExtra.reply(levelUpMsg));
            } else {
                global.db?.scheduleSave();
            }
        }

        return true;
    } catch (err) {
        console.error(`[Plugin Error: ${cmdName}]`, err);
        const errMsg = `❌ Terjadi kesalahan pada fitur *${cmdName}*: ${err.message}`;
        await (m.reply ? m.reply(errMsg) : fullExtra.reply(errMsg));
        return true;
    }
}
