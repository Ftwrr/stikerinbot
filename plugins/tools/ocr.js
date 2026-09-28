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
    const url = String(res.data).trim();
    if (url.startsWith('http')) return url;
    throw new Error('Catbox upload failed: ' + url);
}

async function uploadImageUguu(buffer) {
    const form = new FormData();
    form.append('files[]', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    const res = await axios.post('https://uguu.se/upload.php', form, {
        headers: form.getHeaders(),
        timeout: 30000
    });
    const url = res.data?.files?.[0]?.url;
    if (url && url.startsWith('http')) return url;
    throw new Error('Uguu upload failed');
}

async function uploadTemp(buffer) {
    try {
        return await uploadImageCatbox(buffer);
    } catch (e) {
        console.warn('[OCR] Catbox failed, trying Uguu...');
    }
    return await uploadImageUguu(buffer);
}

const handler = async (m, { client, from, reply }) => {
    const q = m.quoted || m;
    const isImage = q.mtype === 'imageMessage' || q.msg?.imageMessage || q.msg?.mimetype?.startsWith('image/');

    if (!isImage) {
        return reply('⚠️ Balas (reply) foto atau kirim foto dengan caption *.ocr* untuk membaca teks di gambar.');
    }

    if (m.react) await m.react('⏳');

    try {
        const mediaBuffer = await q.download();
        if (!mediaBuffer) throw new Error('Gagal mengunduh gambar');

        const uploadedUrl = await uploadTemp(mediaBuffer);

        const apiUrl = global.API('zans', '/api/tools/ocr', { url: uploadedUrl });
        const res = await axios.get(apiUrl, { timeout: 45000 });
        const data = res.data;

        const extractedText = data?.result?.text || data?.text || data?.result || data?.data?.text;

        if (!extractedText || (typeof extractedText === 'string' && !extractedText.trim())) {
            throw new Error('Tidak ada teks yang terdeteksi pada gambar');
        }

        const replyText = `📄 *HASIL EKSTRAKSI TEKS (OCR)*\n\n${extractedText.trim()}\n\n_Powered by api.zansxart.me_`;
        await reply(replyText);

        if (m.react) await m.react('✅');
    } catch (err) {
        console.error('[OCR Error]', err);
        if (m.react) await m.react('❌');
        await reply(`❌ Gagal membaca teks dari gambar: ${err.message}`);
    }
};

handler.command = ['ocr', 'totext', 'imagetotext'];
handler.category = 'Tools';
handler.desc = 'Ekstraksi teks dari foto/gambar dokumen via api.zansxart.me';
handler.limit = 1;
export default handler;
