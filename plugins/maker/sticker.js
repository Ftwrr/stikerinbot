import { convertToWebp, addExif } from '../../lib/converter.js';

const handler = async (m, { client, from, reply }) => {
    const q = m.quoted || m;
    let actualType = null;

    if (q.mtype === 'imageMessage' || q.msg?.imageMessage) actualType = 'image';
    else if (q.mtype === 'videoMessage' || q.msg?.videoMessage) actualType = 'video';
    else if (q.mtype === 'stickerMessage' || q.msg?.stickerMessage) actualType = 'sticker';
    else if (q.msg?.mimetype?.startsWith('image/')) actualType = 'image';
    else if (q.msg?.mimetype?.startsWith('video/')) actualType = 'video';

    if (!actualType) {
        return reply('⚠️ Kirim foto/video (maks 14s) dengan caption *.s* atau reply media dengan *.s*');
    }

    try {
        const buffer = await q.download();
        if (actualType === 'sticker') {
            const exifBuffer = await addExif(buffer, "AMBATRON");
            await client.sendMessage(from, { sticker: exifBuffer }, { quoted: { key: m.key } });
        } else {
            const webpBuffer = await convertToWebp(buffer, actualType);
            const exifBuffer = await addExif(webpBuffer, "AMBATRON");
            await client.sendMessage(from, { sticker: exifBuffer }, { quoted: { key: m.key } });
        }
    } catch (err) {
        console.error('[Sticker Error]', err);
        await reply(`❌ Gagal membuat sticker: ${err.message}`);
    }
};

handler.command = ['s', 'stiker', 'sticker', 'sgif'];
handler.category = 'Maker';
handler.desc = 'Konversi foto/video jadi stiker WA';
export default handler;
