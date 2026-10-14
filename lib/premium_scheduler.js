import { jidNormalizedUser } from './simple.js';

let cronInterval = null;

export function startPremiumExpiryScheduler(client) {
    if (cronInterval) clearInterval(cronInterval);

    cronInterval = setInterval(async () => {
        if (!global.db?.data?.users || !client) return;

        const now = Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

        for (const [userJid, user] of Object.entries(global.db.data.users)) {
            if (!user || !user.premiumTime) continue;

            const timeLeft = user.premiumTime - now;

            // 1. Notifikasi H-3 (Sisa waktu <= 3 hari dan belum diperingatkan)
            if (timeLeft > 0 && timeLeft <= threeDaysMs && !user.warned3Days) {
                user.warned3Days = true;
                const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
                const msgText = `⏳ *PEMBERITAHUAN MASA AKTIF PREMIUM*\n\nHai kak *${user.name || ''}*, masa aktif langganan Premium bot kamu tersisa *${daysLeft} Hari lagi*.\n\nSegera lakukan perpanjangan agar limit tetap Unlimited dan dapat terus mengakses semua fitur premium.\n\nHubungi Owner: wa.me/${global.owner?.[0] || ''}`;
                
                try {
                    await client.sendMessage(userJid, { text: msgText });
                } catch (e) {
                    console.error(`[Premium Notice H-3 Error to ${userJid}]:`, e.message);
                }
            }

            // 2. Notifikasi Kadaluarsa / Habis
            if (timeLeft <= 0 && user.premium) {
                user.premium = false;
                user.premiumTime = 0;
                user.warned3Days = false;
                user.limit = Math.min(user.limit || 0, 50); // reset limit ke standard jika expired

                const expiredMsg = `🔴 *MASA AKTIF PREMIUM TELAH HABIS*\n\nHai kak *${user.name || ''}*, masa aktif langganan Premium bot kamu telah berakhir.\nStatus akun kamu telah kembali menjadi *Free User*.\n\nTerima kasih telah berlangganan! Untuk memperpanjang masa aktif, silakan hubungi Owner:\n👉 wa.me/${global.owner?.[0] || ''}`;
                
                try {
                    await client.sendMessage(userJid, { text: expiredMsg });
                } catch (e) {
                    console.error(`[Premium Expired Notice Error to ${userJid}]:`, e.message);
                }
            }
        }
    }, 60 * 1000); // Check setiap 1 menit
}
