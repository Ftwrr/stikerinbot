import { getBotSettings, updateBotSettings } from '../../lib/settings.js';
import { jadibotConns } from '../../lib/jadibot_zapo.js';

const handler = async (m, { client, text, args, command, isOwner, reply }) => {
    const cmd = command.toLowerCase();

    // Deteksi jika command dijalankan di sub-bot Jadibot
    let botNum = (client.user?.id || client._botJid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    let isSubBot = jadibotConns.has(botNum);
    let subInst = isSubBot ? jadibotConns.get(botNum) : null;

    if (!subInst) {
        for (const [name, inst] of jadibotConns.entries()) {
            if (inst.conn === client || inst.getBotNumber() === botNum || name === botNum) {
                isSubBot = true;
                subInst = inst;
                botNum = inst.getBotNumber() || name;
                break;
            }
        }
    }

    const getSettingsFn = () => isSubBot && subInst ? subInst.getSettings() : getBotSettings();
    const updateSettingsFn = (data) => isSubBot && subInst ? subInst.updateSettings(data) : updateBotSettings(data);

    // ─── COMMAND: .public / .self ──────────────────────────────────────────────
    if (cmd === 'public') {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengubah mode publik!');
        updateSettingsFn({ publicMode: true });
        return reply('🌍 *MODE BOT: PUBLIK (ON)*\nBot sekarang dapat diakses dan digunakan oleh semua pengguna.');
    }

    if (cmd === 'self') {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengubah mode self!');
        updateSettingsFn({ publicMode: false });
        return reply('🔏 *MODE BOT: SELF (OFF)*\nBot sekarang hanya dapat digunakan oleh nomor bot/Owner itu sendiri.');
    }

    // ─── COMMAND: .on / .off ───────────────────────────────────────────────────
    const action = cmd === 'on';
    const target = (args[0] || '').toLowerCase();

    if (target === 'status' || target === 'sw' || target === 'story') {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengatur auto-read status!');
        updateSettingsFn({ autoReadStatus: action });
        return reply(
            action
                ? '👁️ *AUTO-READ STATUS: AKTIF (ON)*\nBot akan otomatis melihat setiap status / cerita WhatsApp yang masuk.'
                : '❌ *AUTO-READ STATUS: NONAKTIF (OFF)*\nFitur auto-read status dinonaktifkan.'
        );
    }

    if (target === 'grup' || target === 'group' || target === 'gc') {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengatur mode grup!');
        updateSettingsFn({ groupMode: action });
        return reply(
            action
                ? '✅ *MODE GRUP: AKTIF (ON)*\nBot sekarang merespon perintah di dalam grup.'
                : '❌ *MODE GRUP: NONAKTIF (OFF)*\nBot tidak akan merespon perintah di dalam grup (kecuali dari Owner).'
        );
    }

    if (target === 'bot' || target === 'public') {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengatur mode bot!');
        updateSettingsFn({ publicMode: action });
        return reply(
            action
                ? '🌍 *MODE BOT: PUBLIK (ON)*\nBot sekarang dapat digunakan oleh semua orang.'
                : '🔏 *MODE BOT: SELF (OFF)*\nBot sekarang hanya dapat digunakan oleh nomor bot/Owner itu sendiri.'
        );
    }

    if (target === 'autoread' || target === 'read' || target === 'readchat') {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengatur auto-read pesan!');
        updateSettingsFn({ autoReadMessage: action });
        return reply(
            action
                ? '✅ *AUTO-READ PESAN: AKTIF (ON)*\nBot akan otomatis menandai setiap pesan masuk sebagai sudah dibaca (centang biru).'
                : '❌ *AUTO-READ PESAN: NONAKTIF (OFF)*\nBot tidak akan otomatis membaca pesan masuk.'
        );
    }

    if (target === 'anticall' || target === 'call') {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat mengatur anti-call!');
        updateSettingsFn({ antiCall: action });
        return reply(
            action
                ? '🛡️ *ANTI-CALL: AKTIF (ON)*\nBot akan otomatis menolak panggilan masuk dan memblokir penelepon.'
                : '❌ *ANTI-CALL: NONAKTIF (OFF)*\nFitur anti-call dinonaktifkan.'
        );
    }

    // Status Setting Mode
    const s = getSettingsFn();

    const statusTxt = `⚙️ *STATUS PENGATURAN BOT* (${isSubBot ? `Sub-Bot +${botNum}` : 'Bot Utama'})

• Mode Bot       : *${s.publicMode ? '🌍 Publik' : '🔏 Self'}*
• Mode Grup      : *${s.groupMode ? '✅ Aktif' : '❌ Nonaktif'}*
• Auto-Read SW   : *${s.autoReadStatus ? '👁️ Aktif' : '❌ Nonaktif'}*
• Auto-Read CH   : *${s.autoReadMessage ? '📩 Aktif' : '❌ Nonaktif'}*
• Anti-Call      : *${s.antiCall ? '🛡️ Aktif' : '❌ Nonaktif'}*

_Perintah Pengaturan (Khusus Owner):_
• *.on grup* / *.off grup*
• *.on bot* / *.off bot*
• *.on status* / *.off status*
• *.on autoread* / *.off autoread*
• *.on anticall* / *.off anticall*`;

    await reply(statusTxt);
};

handler.command = ['botmode', 'mode', 'self', 'public', 'statusbot', 'anticall'];
handler.category = 'Tools';
handler.limit = false;
handler.desc = 'Pengaturan mode bot (grup, publik, autoread, anticall)';
handler.owner = false;
export default handler;
