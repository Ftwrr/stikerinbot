import fs from 'fs';
import botmodeHandler from './botmode.js';

const AUTH_DIR_NAME = process.env.SESSION_DIR || 'session_auth';
const SETTING_FILE = './db/settings-' + AUTH_DIR_NAME + '.json';

function setAutoReadStatusSetting(enabled) {
    let data = {};
    if (fs.existsSync(SETTING_FILE)) {
        try { data = JSON.parse(fs.readFileSync(SETTING_FILE, 'utf8')); } catch (e) {}
    }
    data.autoReadStatus = enabled;
    fs.writeFileSync(SETTING_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const ON_MSG = '\u2705 *Auto-Read Status/Story AKTIF!*\nBot akan otomatis membaca setiap status WhatsApp yang masuk.';
const OFF_MSG = '\u274c *Auto-Read Status/Story NONAKTIF!*';

const handler = async (m, extra) => {
    const { args, command, reply, isOwner } = extra;
    const sub = (args[0] || '').toLowerCase();
    const isEnable = command.toLowerCase() === 'on';

    if (
        sub === 'grup' || sub === 'group' || sub === 'gc' ||
        sub === 'bot' || sub === 'public' ||
        sub === 'anticall' || sub === 'call' ||
        sub === 'readchat'
    ) {
        return await botmodeHandler(m, extra);
    }

    if (sub === 'autoread') {
        const second = (args[1] || '').toLowerCase();
        if (second === 'status' || second === 'story' || second === 'sw') {
            if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengatur auto-read story!');
            setAutoReadStatusSetting(isEnable);
            return reply(isEnable ? ON_MSG : OFF_MSG);
        }
        return await botmodeHandler(m, extra);
    }

    if (sub === 'status' || sub === 'story' || sub === 'sw') {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengatur auto-read story!');
        setAutoReadStatusSetting(isEnable);
        return reply(isEnable ? ON_MSG : OFF_MSG);
    }

    // ── FITUR KHUSUS GRUP (Bisa diatur oleh Admin Grup atau Owner) ───────────
    if (m.isGroup && ['welcome', 'leave', 'bye', 'detect', 'antilink', 'link'].includes(sub)) {
        let access;
        try {
            const { resolveGroupAccess } = await import('../../lib/group_utils.js');
            access = await resolveGroupAccess(extra.conn || extra.client, m);
        } catch (_) {}

        if (!access?.isAdmin && !isOwner) {
            return reply('⛔ Hanya Admin grup atau Owner bot yang dapat mengubah pengaturan grup ini!');
        }

        global.db.data.chats = global.db.data.chats || {};
        global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {};
        const chatData = global.db.data.chats[m.chat];

        if (sub === 'welcome') {
            chatData.welcome = isEnable;
            global.db.scheduleSave();
            return reply(`👋 Pesan sambutan (welcome) berhasil *${isEnable ? 'DIAKTIFKAN ✅' : 'DIMATIKAN ❌'}*.`);
        }
        if (sub === 'leave' || sub === 'bye') {
            chatData.leave = isEnable;
            global.db.scheduleSave();
            return reply(`👋 Pesan member keluar (leave) berhasil *${isEnable ? 'DIAKTIFKAN ✅' : 'DIMATIKAN ❌'}*.`);
        }
        if (sub === 'detect') {
            chatData.detect = isEnable;
            global.db.scheduleSave();
            return reply(`🔔 Notifikasi promote/demote berhasil *${isEnable ? 'DIAKTIFKAN ✅' : 'DIMATIKAN ❌'}*.`);
        }
        if (sub === 'antilink' || sub === 'link') {
            chatData.antiLink = isEnable;
            global.db.scheduleSave();
            return reply(`🔗 Anti-link grup berhasil *${isEnable ? 'DIAKTIFKAN ✅' : 'DIMATIKAN ❌'}*.`);
        }
    }

    if (isOwner) {
        await reply(`⚠️ *PENGATURAN TIDAK DIKENALI*

*Pilihan Tersedia (Khusus Owner):*
• *.on grup* / *.off grup* (Mode Respon Grup)
• *.on bot* / *.off bot* (Mode Publik / Self)
• *.on status* / *.off status* (Auto-Read Story)
• *.on autoread* / *.off autoread* (Auto-Read Pesan)
• *.on anticall* / *.off anticall* (Anti-Panggilan)`);
    } else {
        await reply(`⚠️ *PENGATURAN TIDAK DIKENALI*

Pengaturan bot hanya dapat diubah oleh Owner.`);
    }
};

handler.command = ['on', 'off'];
handler.help = ['on <fitur>', 'off <fitur>'];
handler.tags = ['tools'];
handler.limit = false;
handler.desc = 'Nyalakan/matikan fitur (grup, bot, status, autoread, anticall)';
export default handler;
