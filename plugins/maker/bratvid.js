import axios from 'axios';

const handler = async (m, { client, from, text, reply }) => {
    let caption = text ? text.trim() : '';
    if (!caption && m.quoted) {
        caption = m.quoted.text || '';
    }

    if (!caption) {
        return reply('⚠️ Masukkan teks untuk brat video!\n\n*Contoh:* *.bratvid Halo dunia*\n\n_Powered by https://api.zansxart.me_');
    }

    if (caption.length > 250) {
        return reply('⚠️ Teks terlalu panjang! Maksimal 250 karakter.');
    }

    if (m.react) await m.react('⏳');

    try {
        const url = global.API('zans', '/api/maker/bratvideo', { text: caption });
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 60000
        });

        if (!res.data || res.data.length < 1000) {
            throw new Error('Response media video tidak valid');
        }

        const videoBuffer = Buffer.from(res.data);
        await client.sendMessage(from, {
            video: videoBuffer,
            caption: `*Brat Video* 🎬\n\n_Powered by api.zansxart.me_`
        }, { quoted: { key: m.key } });

        if (m.react) await m.react('✅');
    } catch (err) {
        console.error('[BratVideo Error]', err);
        if (m.react) await m.react('❌');
        await reply(`❌ Gagal membuat Brat Video: ${err.message}`);
    }
};

handler.command = ['bratvid', 'bratvideo'];
handler.category = 'Maker';
handler.desc = 'Membuat animasi video teks bergaya Brat via api.zansxart.me';
handler.limit = 2;
export default handler;
