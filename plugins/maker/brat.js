import { getBratImage } from '../../lib/brat_generator.js';
import { convertToWebp, addExif } from '../../lib/converter.js';

const handler = async (m, { client, from, text, reply }) => {
    let caption = text;
    if (!caption && m.quoted) {
        caption = m.quoted.text || '';
    }

    if (!caption) {
        return reply('⚠️ Format salah! Gunakan *.b [teks]* atau balas pesan teks dengan *.b*');
    }

    if (caption.length > 120) {
        return reply('⚠️ Teks terlalu panjang! Maksimal 120 karakter.');
    }

    try {
        const pngBuffer = await getBratImage(caption);
        const webpSticker = await convertToWebp(pngBuffer, 'image');
        const exifBuffer = await addExif(webpSticker, "stikerin.my.id");
        await client.sendMessage(from, { sticker: exifBuffer }, { quoted: { key: m.key } });
    } catch (err) {
        console.error('[Brat Error]', err);
        await reply(`❌ Gagal membuat stiker brat: ${err.message}`);
    }
};

handler.command = ['b', 'brat'];
handler.category = 'Maker';
handler.desc = 'Bikin stiker teks gaya Brat';
export default handler;
