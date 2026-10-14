import { resolveGroupAccess } from '../../lib/group_utils.js';

const handler = async (m, { args, command, reply }) => {
    if (!m.isGroup) {
        return reply('👥 Fitur anti-link hanya berlaku di dalam grup!');
    }

    if (!global.db.data.chats[m.chat]) {
        global.db.data.chats[m.chat] = { isBanned: false, welcome: true, mute: false, antiLink: false };
    }
    const chat = global.db.data.chats[m.chat];

    const sub = (args[0] || '').toLowerCase();

    if (!sub || !['on', 'off', 'nyala', 'mati', 'status'].includes(sub)) {
        return reply(
            `🔗 *ANTI-LINK GRUP*\n\n` +
            `Status saat ini: *${chat.antiLink ? 'AKTIF ✅' : 'NONAKTIF ❌'}*\n\n` +
            `• *.${command} on* — aktifkan\n` +
            `• *.${command} off* — matikan\n\n` +
            `Saat aktif, link dari anggota non-admin otomatis dihapus.`
        );
    }

    if (sub === 'status') {
        return reply(`🔗 Anti-link sekarang: *${chat.antiLink ? 'AKTIF ✅' : 'NONAKTIF ❌'}*`);
    }

    chat.antiLink = ['on', 'nyala'].includes(sub);
    global.db.scheduleSave();

    return reply(`🔗 Anti-link berhasil *${chat.antiLink ? 'DIAKTIFKAN ✅' : 'DIMATIKAN ❌'}*.`);
};

handler.command = ['antilink', 'antilinkgc', 'nolink'];
handler.category = 'Group';
handler.desc = 'Aktifkan/matikan anti-link di grup (Admin only)';
handler.group = true;
handler.admin = true;
handler.limit = false;
export default handler;
