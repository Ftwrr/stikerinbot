import axios from 'axios';

const pad = n => String(n).padStart(2, '0');

async function generateIqc(text) {
    const now = new Date();
    const time = `${pad(now.getHours())}.${pad(now.getMinutes())}`;
    
    try {
        const url = global.API('zans', '/api/maker/iqc', {
            text,
            chatTime: time,
            statusBarTime: time
        });
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 20000
        });
        if (res.data && res.data.length > 1000) return Buffer.from(res.data);
    } catch (e) {
        console.error('[IQC API Zans Error]', e.message);
    }

    return null;
}

const handler = async (m, { client, from, text, reply }) => {
    let content = (text || '').trim();
    if (!content && m.quoted) {
        content = (m.quoted.text || m.quoted.caption || '').trim();
    }

    if (!content) {
        return reply('⚠️ Masukkan teks chat, atau balas (reply) pesan teks dengan *.iqc*\n\nContoh: *.iqc Halo semua, lagi apa?*\n\n_Powered by https://api.zansxart.me_');
    }

    if (content.length > 300) {
        return reply('⚠️ Teks terlalu panjang! Maksimal 300 karakter agar rapi di layar.');
    }

    if (m.react) await m.react('⏳');

    try {
        const image = await generateIqc(content);
        if (!image) {
            if (m.react) await m.react('❌');
            return reply('❌ Gagal membuat fake chat iPhone via api.zansxart.me. Coba lagi beberapa saat.');
        }

        await client.sendMessage(from, {
            image,
            caption: '*Fake Chat iPhone ✅*\n\n_Powered by api.zansxart.me_'
        }, { quoted: { key: m.key } });

        if (m.react) await m.react('✅');
    } catch (err) {
        console.error('[IQC Error]', err);
        if (m.react) await m.react('❌');
        await reply('❌ Gagal membuat fake chat iPhone: ' + err.message);
    }
};

handler.command = ['iqc'];
handler.category = 'Maker';
handler.desc = 'Membuat fake chat iPhone (iMessage style) via api.zansxart.me';
handler.limit = 1;
export default handler;
