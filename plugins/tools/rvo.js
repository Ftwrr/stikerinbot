import { unwrapMessage, getContentType } from 'zapo-js';
import { downloadMedia, restoreMediaBuffers, loadMessageById } from '../../lib/simple.js';

const handler = async (m, { client, from, reply }) => {
    if (!m.quoted) {
        return reply('⚠️ Balas/reply pesan View-Once (Sekali Lihat) dengan caption *.rvo*');
    }

    try {
        const sendChat = from || m.chat;

        // 1. Ambil pesan yang di-reply (cek di SQLite / disk cache dulu untuk mendapatkan payload lengkap)
        let targetMsg = loadMessageById(m.quoted.id) || m.quoted.message || m.quoted.msg;
        targetMsg = unwrapMessage(targetMsg) || targetMsg;
        targetMsg = restoreMediaBuffers(targetMsg);

        // 2. Deteksi media
        const imageMsg = targetMsg.imageMessage || targetMsg.message?.imageMessage;
        const videoMsg = targetMsg.videoMessage || targetMsg.message?.videoMessage;
        const audioMsg = targetMsg.audioMessage || targetMsg.message?.audioMessage;

        if (imageMsg) {
            const buf = await downloadMedia(targetMsg, client);
            const caption = imageMsg.caption ? `🔓 *[View-Once Unlocked]*\n\n${imageMsg.caption}` : '🔓 *[View-Once Unlocked]*';
            await client.sendMessage(sendChat, {
                image: buf,
                mimetype: imageMsg.mimetype || 'image/jpeg',
                caption
            }, { quoted: { key: m.key } });
        } else if (videoMsg) {
            const buf = await downloadMedia(targetMsg, client);
            const caption = videoMsg.caption ? `🔓 *[View-Once Unlocked]*\n\n${videoMsg.caption}` : '🔓 *[View-Once Unlocked]*';
            await client.sendMessage(sendChat, {
                video: buf,
                mimetype: videoMsg.mimetype || 'video/mp4',
                caption
            }, { quoted: { key: m.key } });
        } else if (audioMsg) {
            const buf = await downloadMedia(targetMsg, client);
            await client.sendMessage(sendChat, {
                audio: buf,
                mimetype: audioMsg.mimetype || 'audio/mp4',
                ptt: audioMsg.ptt || false
            }, { quoted: { key: m.key } });
        } else {
            return reply('⚠️ Media View-Once tidak ditemukan pada pesan yang dibalas.');
        }
    } catch (err) {
        console.error('[RVO Error]', err);
        await reply(`❌ Gagal membuka View-Once: ${err.message}`);
    }
};

handler.command = ['rvo', 'readviewonce', 'viewonce'];
handler.category = 'Tools';
handler.desc = 'Buka media sekali lihat (View-Once)';
handler.owner = false;
export default handler;
