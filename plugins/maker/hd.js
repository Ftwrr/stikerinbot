import axios from 'axios';
import FormData from 'form-data';

async function uploadImageCatbox(buffer) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 30000
    });
    return String(res.data).trim();
}

async function uploadImageUguu(buffer) {
    const form = new FormData();
    form.append('files[]', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    const res = await axios.post('https://uguu.se/upload.php', form, {
        headers: form.getHeaders(),
        timeout: 30000
    });
    return res.data?.files?.[0]?.url || null;
}

async function uploadTemp(buffer) {
    try {
        const url = await uploadImageCatbox(buffer);
        if (url && url.startsWith('http')) return url;
    } catch (e) {}

    try {
        const url = await uploadImageUguu(buffer);
        if (url && url.startsWith('http')) return url;
    } catch (e) {}

    throw new Error('Gagal mengupload gambar sementara untuk diproses HD');
}

const handler = async (m, { client, from, args, reply }) => {
    const q = m.quoted || m;
    const isImage = q.mtype === 'imageMessage' || q.msg?.imageMessage || q.msg?.mimetype?.startsWith('image/');

    if (!isImage) {
        return reply('⚠️ Balas (reply) foto atau kirim foto dengan caption *.hd*');
    }

    let scale = 2;
    if (args[0] && ['2', '4'].includes(args[0])) {
        scale = parseInt(args[0], 10);
    }

    if (m.react) await m.react('⏳');

    try {
        const mediaBuffer = await q.download();
        if (!mediaBuffer) throw new Error('Gagal mendownload media gambar');

        const uploadedUrl = await uploadTemp(mediaBuffer);

        const apiUrl = global.API('zans', '/api/tools/upscale', {
            url: uploadedUrl,
            scale: scale
        });

        const res = await axios.get(apiUrl, { timeout: 60000 });
        const data = res.data;

        let resultImageBuffer = null;
        if (data.status && data.result?.url) {
            const getImg = await axios.get(data.result.url, { responseType: 'arraybuffer' });
            resultImageBuffer = Buffer.from(getImg.data);
        } else if (Buffer.isBuffer(data)) {
            resultImageBuffer = data;
        }

        if (!resultImageBuffer) {
            throw new Error(data.message || 'Gagal memproses HD pada gambar');
        }

        await client.sendMessage(from, {
            image: resultImageBuffer,
            caption: `✨ *Berhasil di-Upscale (${scale}x)*\n\n_Powered by api.zansxart.me_`
        }, { quoted: { key: m.key } });

        if (m.react) await m.react('✅');
    } catch (err) {
        console.error('[HD Error]', err);
        if (m.react) await m.react('❌');
        await reply(`❌ Gagal meningkatkan kualitas foto: ${err.message}`);
    }
};

handler.command = ['hd', 'remini', 'upscale'];
handler.category = 'Maker';
handler.desc = 'Meningkatkan resolusi foto (HD) via api.zansxart.me';
handler.limit = 1;
export default handler;
