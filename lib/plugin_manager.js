import './config.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { resolveGroupAccess } from './group_utils.js';
import { printCommandLog } from './logger.js';

let _pluginCache = [];
let _pluginMap = new Map();
let _customHandlers = [];
const PLUGINS_DIR = path.join(process.cwd(), 'plugins');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Anti-Spam Queue / Promise Chain per user
const userQueueMap = new Map();
const COMMAND_COOLDOWN_MS = process.env.COMMAND_COOLDOWN_MS ? parseInt(process.env.COMMAND_COOLDOWN_MS, 10) : 1500;

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

    // 1. Command handler (misal: .menu, /ping, $ ls)
    const match = text.match(/^([\.\/\!\#\$])\s*(\w+)(?:\s+(.*))?$/s);
    if (match) {
        const usedPrefix = match[1];
        const cmdName = match[2].toLowerCase();
        const textParam = (match[3] || '').trim();
        const plugin = _pluginMap.get(cmdName);

        if (plugin) {
            const isOwner = m.isOwner !== undefined ? m.isOwner : extra.isOwner;
            const user = global.db?.data?.users?.[m.sender];

            // ─── BANNED GUARD (Kecuali Owner & Command unban) ───────────
            if (user?.banned && !isOwner && cmdName !== 'unban') {
                let bannedInfo = '🚫 *AKUN DIBANNED!*\n\nAkun Anda sedang dalam status banned.';
                if (user.bannedExpiry && user.bannedExpiry > Date.now()) {
                    const sisaHari = Math.ceil((user.bannedExpiry - Date.now()) / (24 * 60 * 60 * 1000));
                    const expDateStr = new Date(user.bannedExpiry).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                    });
                    bannedInfo += `\n⏳ *Sisa Hukuman:* ${sisaHari} Hari lagi (hingga ${expDateStr}).\nAkun akan otomatis dibuka setelah masa banned selesai.`;
                }
                bannedInfo += '\n\nSilakan hubungi Owner bot untuk informasi pembukaan status banned.';

                await (m.reply ? m.reply(bannedInfo) : extra.reply(bannedInfo));
                return true;
            }

            // ─── CHAT MUTE GUARD (Kecuali Owner) ────────────────────────────
            const chatData = global.db?.data?.chats?.[m.chat];
            if (chatData?.isMuted && !isOwner) {
                return true;
            }

            // ─── ANTI-SPAM QUEUE SEQUENTIAL RUNNER (Kecuali Owner) ───────────
            if (!isOwner) {
                const prevPromise = userQueueMap.get(m.sender) || Promise.resolve();
                const currentTask = prevPromise
                    .catch(() => {})
                    .then(async () => {
                        await delay(COMMAND_COOLDOWN_MS);
                        return executePlugin(m, plugin, cmdName, textParam, usedPrefix, fullExtra, isOwner);
                    });

                userQueueMap.set(m.sender, currentTask);
                currentTask.finally(() => {
                    if (userQueueMap.get(m.sender) === currentTask) {
                        userQueueMap.delete(m.sender);
                    }
                });

                return await currentTask;
            }

            return await executePlugin(m, plugin, cmdName, textParam, usedPrefix, fullExtra, isOwner);
        }
    }

    // 2. Custom handlers
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
 * Eksekusi plugin dengan permission check
 */
async function executePlugin(m, plugin, cmdName, textParam, usedPrefix, fullExtra, isOwner) {
    // 1. Owner Only
    if (plugin.owner && !isOwner) {
        await (m.reply ? m.reply('⛔ Perintah ini hanya untuk Owner bot!') : fullExtra.reply('⛔ Perintah ini hanya untuk Owner bot!'));
        return true;
    }

    // 2. Group Only
    if (plugin.group && !m.isGroup) {
        await (m.reply ? m.reply('👥 Perintah ini hanya dapat digunakan di dalam grup!') : fullExtra.reply('👥 Perintah ini hanya dapat digunakan di dalam grup!'));
        return true;
    }

    // 2b. Group Admin Only
    if (plugin.admin && m.isGroup && !isOwner) {
        let isAdmin = false;
        try {
            ({ isAdmin } = await resolveGroupAccess(fullExtra.conn || fullExtra.client, m));
        } catch (e) {
            console.error('[Admin Guard Error]', e.message);
        }
        if (!isAdmin) {
            await (m.reply ? m.reply('⛔ Perintah ini hanya dapat digunakan oleh Admin grup!') : fullExtra.reply('⛔ Perintah ini hanya dapat digunakan oleh Admin grup!'));
            return true;
        }
    }

    // 3. Private Chat Only
    if (plugin.private && m.isGroup) {
        await (m.reply ? m.reply('🔒 Perintah ini hanya dapat digunakan di chat pribadi (DM/PC)!') : fullExtra.reply('🔒 Perintah ini hanya dapat digunakan di chat pribadi (DM/PC)!'));
        return true;
    }

    const startExec = Date.now();
    try {
        await plugin(m, {
            ...fullExtra,
            command: cmdName,
            text: textParam,
            args: textParam.split(' ').filter(Boolean),
            usedPrefix,
            isOwner
        });

        const durationMs = Date.now() - startExec;
        printCommandLog({
            cmdName,
            sender: m.sender,
            senderName: m.name || m.pushName,
            isGroup: m.isGroup,
            chatName: fullExtra.chatName || m.chat,
            durationMs
        });

        // ─── REWARD EXP & LEVEL UP ───────────────────────────────────
        const user = global.db?.data?.users?.[m.sender];
        if (user) {
            const gainedExp = Math.floor(Math.random() * 9) + 1;
            user.exp = (user.exp || 0) + gainedExp;

            const currentLevel = user.level || 1;
            const neededExp = currentLevel * 1000;
            if (user.exp >= neededExp) {
                user.level = currentLevel + 1;
                global.db?.scheduleSave();

                const levelUpMsg = `🆙 *LEVEL UP!* 🆙\n\nSelamat *@${m.sender.split('@')[0]}*, kamu naik ke *Level ${user.level}*!\n⚡ Total EXP: *${user.exp.toLocaleString('id-ID')} EXP*`;
                await (m.reply ? m.reply(levelUpMsg) : fullExtra.reply(levelUpMsg));
            } else {
                global.db?.scheduleSave();
            }
        }

        return true;
    } catch (err) {
        const durationMs = Date.now() - startExec;
        printCommandLog({
            cmdName,
            sender: m.sender,
            senderName: m.name || m.pushName,
            isGroup: m.isGroup,
            chatName: fullExtra.chatName || m.chat,
            durationMs,
            error: err
        });
        const errMsg = `❌ Terjadi kesalahan pada fitur *${cmdName}*: ${err.message}`;
        await (m.reply ? m.reply(errMsg) : fullExtra.reply(errMsg));
        return true;
    }
}
