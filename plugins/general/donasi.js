import fs from 'fs';
import path from 'path';

const DONASI_IMAGE_PATH = path.join(process.cwd(), 'src', 'donasi.png');

const handler = async (m, { client, from, reply }) => {
    const caption = `☕ *DONASI & DUKUNG STIKERIN BOT*

Bantu kami menjaga bot tetap aktif 24/7 dan terus mengembangkan fitur-fitur baru.

📱 *Cara Donasi:*
1. Scan QRIS di atas menggunakan GoPay, OVO, Dana, ShopeePay, BCA, Livin, atau M-Banking apapun.
2. Masukkan nominal donasi seikhlasnya.
3. Setiap donasi sangat berarti bagi keberlangsungan bot ini.

🌐 *Website Resmi:*
https://stikerin.my.id

_Terima kasih banyak atas dukungan Anda! 🙏_`;

    try {
        if (fs.existsSync(DONASI_IMAGE_PATH)) {
            const imgBuffer = fs.readFileSync(DONASI_IMAGE_PATH);
            await client.sendMessage(from, {
                image: imgBuffer,
                caption
            }, { quoted: { key: m.key } });
        } else {
            await reply(caption);
        }
    } catch (err) {
        console.error('[Donasi Error]', err.message);
        await reply(caption);
    }
};

handler.command = ['donasi', 'donate', 'dukung'];
handler.category = 'General';
handler.desc = 'Menampilkan QRIS donasi resmi stikerin.my.id';
handler.limit = false;
export default handler;
