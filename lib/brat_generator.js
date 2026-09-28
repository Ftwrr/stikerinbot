import axios from 'axios';

export async function getBratImage(text) {
    const cleanText = text.trim();
    const url = global.API('zans', '/api/maker/brat', { text: cleanText });
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000
    });
    if (res.data && res.data.length > 500) {
        return Buffer.from(res.data);
    }
    throw new Error('Gagal mendapatkan gambar brat dari API');
}
