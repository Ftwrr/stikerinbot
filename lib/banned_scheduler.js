import { jidNormalizedUser } from './simple.js';

let bannedCronInterval = null;

/**
 * Scheduler pengecekan masa berlaku banned user (30 hari).
 * Setiap 1 menit memeriksa apakah hukuman banned user sudah selesai.
 * Jika selesai: buka banned & kirim pesan notifikasi.
 */
export function startBannedExpiryScheduler(client) {
    if (bannedCronInterval) clearInterval(bannedCronInterval);

    bannedCronInterval = setInterval(async () => {
        if (!global.db?.data?.users || !client) return;

        const now = Date.now();
        let shouldSave = false;

        for (const [userJid, user] of Object.entries(global.db.data.users)) {
            if (!user || !user.banned) continue;

            // Jika ada waktu expiry dan sudah lewat waktu
            if (user.bannedExpiry && now >= user.bannedExpiry) {
                user.banned = false;
                user.bannedExpiry = null;
                user.bannedReason = '';
                shouldSave = true;

                const unbanNotice = `✅ *STATUS BANNED BERAKHIR!*\n\nMasa hukuman banned Anda telah selesai. Akun Anda telah dibuka kembali dan dapat menggunakan fitur bot seperti semula.\n\n⚠️ *Peringatan:* Harap patuhi aturan bot dan jangan melakukan panggilan suara maupun video ke bot agar tidak terkena banned kembali.`;

                try {
                    await client.sendMessage(userJid, { text: unbanNotice });
                    console.log(`[Banned Scheduler] User ${userJid} otomatis di-unban (masa berlaku 30 hari selesai).`);
                } catch (e) {
                    console.error(`[Banned Notice Error to ${userJid}]:`, e.message);
                }
            }
        }

        if (shouldSave && global.db?.scheduleSave) {
            global.db.scheduleSave();
        }
    }, 60 * 1000); // Periksa setiap 1 menit
}
