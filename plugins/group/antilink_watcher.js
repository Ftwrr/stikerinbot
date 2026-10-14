import { resolveGroupAccess } from '../../lib/group_utils.js';

const LINK_REGEX = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[0-9A-Za-z]{15,}|wa\.me\/[0-9]+)/i;

/**
 * Custom handler (bukan command): dijalankan untuk tiap pesan grup.
 * Menghapus link dari anggota non-admin saat antiLink aktif.
 */
const handler = async (m, { client, reply }) => {
    if (!m.isGroup || m.key?.fromMe) return false;

    const chat = global.db?.data?.chats?.[m.chat];
    if (!chat || !chat.antiLink) return false;

    const text = m.cleanText || m.text || '';
    if (!text || !LINK_REGEX.test(text)) return false;

    // Owner bebas kirim link
    if (m.isOwner) return false;

    let isAdmin = false;
    let isBotAdmin = false;
    try {
        const access = await resolveGroupAccess(client, m);
        isAdmin = access.isAdmin;
        isBotAdmin = access.isBotAdmin;
    } catch (_) {}
    if (isAdmin) return false;

    if (!isBotAdmin) {
        // Bot bukan admin → tidak bisa hapus pesan, cukup peringatkan pemilik grup.
        return false;
    }

    try {
        await client.sendMessage(m.chat, {
            delete: {
                id: m.key.id,
                remoteJid: m.chat,
                fromMe: false,
                participant: m.key.participant || m.sender
            }
        });

        await reply(
            `⚠️ *ANTI-LINK AKTIF!*\n\n` +
            `Maaf @${m.senderNumber}, link dilarang dikirim di grup ini. Pesanmu telah dihapus otomatis.`,
            { mentions: [m.sender] }
        );
        return true;
    } catch (e) {
        console.error('[Anti-Link] gagal hapus pesan:', e.message);
    }

    return false;
};

handler.custom = true;
export default handler;
