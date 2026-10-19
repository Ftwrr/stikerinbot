import { resolveGroupAccess, invalidateGroupCache } from '../../lib/group_utils.js';

const handler = async (m, { client, command, reply }) => {
    if (!m.isGroup) {
        return reply('👥 Perintah ini hanya bisa dipakai di dalam grup!');
    }

    const access = await resolveGroupAccess(client, m);
    if (!access.isAdmin && !m.isOwner) {
        return reply('⛔ Hanya Admin grup atau Owner yang bisa mengubah setelan grup!');
    }
    if (!access.isBotAdmin && !m.isOwner) {
        return reply('⚠️ Jadikan bot sebagai *Admin grup* dulu untuk mengubah setelan grup.');
    }

    const cmd = (command || '').toLowerCase();

    try {
        switch (cmd) {
            case 'close':
            case 'tutup': {
                await client.group.setSetting(m.chat, 'announcement', true);
                invalidateGroupCache(m.chat);
                return reply('🔒 *Grup Ditutup!*\nSekarang hanya Admin grup yang dapat mengirim pesan.');
            }

            case 'open':
            case 'buka': {
                await client.group.setSetting(m.chat, 'announcement', false);
                invalidateGroupCache(m.chat);
                return reply('🔓 *Grup Dibuka!*\nSekarang semua anggota grup dapat mengirim pesan.');
            }

            case 'lock':
            case 'kunci': {
                await client.group.setSetting(m.chat, 'restrict', true);
                invalidateGroupCache(m.chat);
                return reply('🔐 *Edit Info Grup Dikunci!*\nHanya Admin yang dapat mengubah nama, deskripsi, dan ikon grup.');
            }

            case 'unlock':
            case 'bukakunci': {
                await client.group.setSetting(m.chat, 'restrict', false);
                invalidateGroupCache(m.chat);
                return reply('🔓 *Edit Info Grup Dibuka!*\nSemua anggota dapat mengubah nama, deskripsi, dan ikon grup.');
            }
        }
    } catch (e) {
        console.error('[Group Setting Error]', e);
        return reply(`❌ Gagal: ${e.message || e}`);
    }
};

handler.help = ['open', 'close', 'lock', 'unlock'];
handler.tags = ['group'];
handler.command = ['close', 'tutup', 'open', 'buka', 'lock', 'kunci', 'unlock', 'bukakunci'];
handler.desc = 'Buka/tutup chat grup dan kunci/buka edit info grup';
handler.group = true;
handler.admin = true;

export default handler;
