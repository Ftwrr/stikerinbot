import { requestApi } from './api_client.js';

export async function getBratImage(text) {
    const cleanText = text.trim();
    const data = await requestApi('zans', '/api/maker/brat', { text: cleanText }, {
        responseType: 'arraybuffer',
        timeout: 15000
    });
    if (data && data.length > 500) {
        return Buffer.from(data);
    }
    throw new Error('Gagal mendapatkan gambar brat dari API');
}
