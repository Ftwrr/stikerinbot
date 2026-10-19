import { resolveTarget, numFromJid } from '../../lib/group_utils.js';

const handler = async (m, { client, text, command, reply }) => {
    const cmd = (command || '').toLowerCase();

    // 1. Tentukan JID target (bisa dari mention, reply, teks nomor, atau diri sendiri)
    let targetJid = resolveTarget(m, text);
    if (!targetJid) {
        if (text) {
            const clean = text.replace(/[^0-9]/g, '');
            if (clean.length >= 9) {
                targetJid = `${clean}@s.whatsapp.net`;
            }
        }
    }

    if (!targetJid) {
        // Jika tidak ada mention/reply/nomor, default ke pengirim pesan
        targetJid = m.sender;
    }

    const cleanPhone = numFromJid(targetJid);

    try {
        if (cmd === 'getpp' || cmd === 'pp') {
            await reply('⏳ Mengambil foto profil...');
            let ppResult = null;
            try {
                ppResult = await client.profile.getProfilePicture(targetJid, 'image');
            } catch (_) {}

            if (!ppResult || !ppResult.url) {
                return reply(`ℹ️ Pengguna *+${cleanPhone}* tidak memiliki foto profil atau menyembunyikannya (privasi).`);
            }

            // Kirim gambar langsung via URL foto profil WhatsApp
            return await client.sendMessage(m.chat, {
                image: { url: ppResult.url },
                caption: `📸 *Foto Profil WhatsApp:*\n• User: *+${cleanPhone}*`
            }, { quoted: { key: m.key } });
        }

        if (cmd === 'getbio' || cmd === 'bio' || cmd === 'about') {
            let bioText = null;
            try {
                const res = await client.profile.getStatus(targetJid);
                bioText = res?.status;
            } catch (_) {}

            if (!bioText) {
                try {
                    bioText = await client.profile.getAboutStatus(targetJid);
                } catch (_) {}
            }

            if (!bioText) {
                return reply(`ℹ️ Bio / Tentang untuk *+${cleanPhone}* tidak tersedia atau disetel ke privasi.`);
            }

            return reply(
                `📝 *STATUS / BIO WHATSAPP*\n\n` +
                `• Nomor : *+${cleanPhone}*\n` +
                `• Bio   : "${bioText}"`
            );
        }
    } catch (err) {
        console.error('[Inspect Profile Error]', err);
        return reply(`❌ Gagal mengambil informasi profil: ${err.message || err}`);
    }
};

handler.help = ['getpp [@user/reply]', 'getbio [@user/reply]'];
handler.tags = ['tools'];
handler.command = ['getpp', 'pp', 'getbio', 'bio', 'about'];
handler.desc = 'Ambil foto profil HD dan teks bio asli WhatsApp pengguna';

export default handler;
