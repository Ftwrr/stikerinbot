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
        console.warn('[RemoveBG] Catbox failed, trying Uguu...');
    }
    return await uploadImageUguu(buffer);
}

const handler = async (m, { client, from, reply }) => {
    const q = m.quoted || m;
    const isImage = q.mtype === 'imageMessage' || q.msg?.imageMessage || q.msg?.mimetype?.startsWith('image/');

    if (!isImage) {
        return reply('⚠️ Balas (reply) foto atau kirim foto dengan caption *.removebg*');
    }

    if (m.react) await m.react('⏳');

    try {
        const mediaBuffer = await q.download();
        if (!mediaBuffer) throw new Error('Gagal mendownload foto');

        const uploadedUrl = await uploadTemp(mediaBuffer);

        const apiUrl = global.API('zans', '/api/tools/removebg', { url: uploadedUrl });
        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });

        if (!res.data || res.data.length < 500) {
            throw new Error('Response gambar transparan tidak valid');
        }

        const pngBuffer = Buffer.from(res.data);

        await client.sendMessage(from, {
            document: pngBuffer,
            mimetype: 'image/png',
            fileName: 'removebg_result.png',
            caption: '✨ *Background berhasil dihapus! (Format Dokumen PNG Transparan)*\n\n_Powered by api.zansxart.me_'
        }, { quoted: { key: m.key } });

        if (m.react) await m.react('✅');
    } catch (err) {
        console.error('[RemoveBG Error]', err);
        if (m.react) await m.react('❌');
        await reply(`❌ Gagal menghapus background: ${err.message}`);
    }
};

handler.command = ['removebg', 'nobg', 'hapusbg'];
handler.category = 'Maker';
handler.desc = 'Hapus background foto jadi transparan via api.zansxart.me';
handler.limit = 1;
export default handler;
