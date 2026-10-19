import { resolveGroupAccess } from '../../lib/group_utils.js';

const handler = async (m, { client, reply }) => {
    if (!m.isGroup) {
        return reply('👥 Perintah ini hanya bisa dipakai di dalam grup!');
    }

    const access = await resolveGroupAccess(client, m);
    if (!access.isAdmin && !m.isOwner) {
        return reply('⛔ Hanya Admin grup atau Owner yang bisa memerintahkan bot keluar!');
    }

    await reply('👋 *Selamat tinggal semuanya!* Bot keluar dari grup.');
    await client.group.leaveGroup([m.chat]);
};

handler.help = ['leave'];
handler.tags = ['group'];
handler.command = ['leave', 'keluar'];
handler.desc = 'Perintahkan bot keluar dari grup (Admin/Owner only)';
handler.group = true;
handler.admin = true;

export default handler;
