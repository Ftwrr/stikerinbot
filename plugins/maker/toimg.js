import { convertWebpToMedia } from '../../lib/converter.js';

const handler = async (m, { client, from, reply }) => {
    const q = m.quoted || m;

    let stickerMessage = q.mtype === 'stickerMessage' || q.msg?.stickerMessage || q.msg?.mimetype?.includes('webp');
    if (!stickerMessage) {
        return reply('⚠️ Balas/reply stiker dengan *.toimg* atau *.tovideo*');
    }

    try {
        const isAnimated = Boolean(q.msg?.isAnimated || q.msg?.stickerMessage?.isAnimated);
        const buffer = await q.download();
        const result = await convertWebpToMedia(buffer, isAnimated);

        if (result.isVideo) {
            await client.sendMessage(from, { video: result.buffer, mimetype: 'video/mp4', caption: '✨ Berhasil dikonversi ke video!' }, { quoted: { key: m.key } });
        } else {
            await client.sendMessage(from, { image: result.buffer, mimetype: 'image/png', caption: '✨ Berhasil dikonversi ke gambar!' }, { quoted: { key: m.key } });
        }
    } catch (err) {
        console.error('[ToImg Error]', err);
        await reply(`❌ Gagal konversi stiker: ${err.message}`);
    }
};

handler.command = ['toimg', 'tovideo', 'tovid'];
handler.help = ['toimg'];
handler.tags = ['maker'];
handler.desc = 'Ubah stiker jadi gambar/video';
export default handler;
