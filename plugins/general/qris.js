import fs from 'fs';
import path from 'path';

const handler = async (m, { client, from, text, args, command, reply }) => {
    const ownerContact = global.owner?.[0] || '';

    const infoText = `💳 *INFORMASI SEWA BOT & PREMIUM (MANUAL)*

Untuk melakukan Sewa Bot ke Grup atau Upgrade User Premium, silakan hubungi Owner kami secara manual:

👑 *Paket Premium User:*
• 30 Hari (1 Bulan): Rp 7.000
_Keuntungan: Bebas limit & tanpa jeda delay di private chat._

🤖 *Paket Sewa Bot Grup:*
• Paket 1 Hari   : Rp 2.000
• Paket 7 Hari   : Rp 5.000
• Paket 30 Hari  : Rp 15.000
_Keuntungan: Bot aktif di grup, semua member grup gratis pakai tanpa limit._

📲 *Metode Pembayaran (Manual):*
• QRIS / All E-Wallet (Dana, OVO, Gopay, ShopeePay)
• Transfer Bank

Hubungi Owner untuk konfirmasi pembayaran:
👉 *https://wa.me/${ownerContact}?text=Halo+Owner+saya+mau+sewa+bot+/+beli+premium*`;

    const qrisImgPath = path.join(process.cwd(), 'src', 'donasi.png');
    if (fs.existsSync(qrisImgPath)) {
        await client.sendMessage(from, {
            image: fs.readFileSync(qrisImgPath),
            caption: infoText
        }, { quoted: { key: m.key } });
    } else {
        await reply(infoText);
    }
};

handler.command = ['qris', 'sewa', 'sewabot', 'topup', 'beliprem', 'orderprem'];
handler.category = 'General';
handler.desc = 'Informasi sewa bot dan paket premium manual';
handler.limit = false;
export default handler;
