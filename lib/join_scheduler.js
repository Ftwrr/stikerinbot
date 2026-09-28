let joinSchedulerTimer = null;

const MS_1_MIN = 60 * 1000;
const MS_1_HOUR = 60 * 60 * 1000;
const MS_1_DAY = 24 * 60 * 60 * 1000;

export function startJoinExpiryScheduler(client, getClientsFn) {
    if (joinSchedulerTimer) clearInterval(joinSchedulerTimer);

    joinSchedulerTimer = setInterval(async () => {
        if (!global.db?.data?.chats) return;

        const now = Date.now();
        const chats = global.db.data.chats;

        // Kumpulkan semua client aktif (utama + sub-bot jadibot)
        const clients = [client];
        if (typeof getClientsFn === 'function') {
            const extra = getClientsFn();
            if (Array.isArray(extra)) clients.push(...extra);
        }

        for (const [chatId, chatData] of Object.entries(chats)) {
            if (!chatData || !chatData.joinExpiry) continue;
            if (!chatId.endsWith('@g.us')) continue;

            const remaining = chatData.joinExpiry - now;
            chatData.warnings = chatData.warnings || {};

            // Helper kirim pesan ke grup lewat client yang sedang berada di grup
            const sendGroupMsg = async (text) => {
                for (const c of clients) {
                    if (c && typeof c.sendMessage === 'function') {
                        try {
                            await c.sendMessage(chatId, { text });
                            return true;
                        } catch (e) { console.error('[Join Scheduler Leave Error]', chatId, e.message); }
                    }
                }
                return false;
            };

            // 1. Sisa 3 Hari
            if (remaining <= 3 * MS_1_DAY && remaining > 2 * MS_1_DAY && !chatData.warnings['3d']) {
                chatData.warnings['3d'] = true;
                await sendGroupMsg('⏳ *PEMBERITAHUAN SEWA BOT*\nMasa aktif bot di grup ini tersisa *3 Hari lagi*.');
                global.db.scheduleSave();
            }

            // 2. Sisa 2 Hari
            if (remaining <= 2 * MS_1_DAY && remaining > 1 * MS_1_DAY && !chatData.warnings['2d']) {
                chatData.warnings['2d'] = true;
                await sendGroupMsg('⏳ *PEMBERITAHUAN SEWA BOT*\nMasa aktif bot di grup ini tersisa *2 Hari lagi*.');
                global.db.scheduleSave();
            }

            // 3. Sisa 1 Hari
            if (remaining <= 1 * MS_1_DAY && remaining > MS_1_HOUR && !chatData.warnings['1d']) {
                chatData.warnings['1d'] = true;
                await sendGroupMsg('⏳ *PEMBERITAHUAN SEWA BOT*\nMasa aktif bot di grup ini tersisa *1 Hari lagi*. Silakan hubungi Owner untuk perpanjangan.');
                global.db.scheduleSave();
            }

            // 4. Sisa 1 Jam
            if (remaining <= MS_1_HOUR && remaining > MS_1_MIN && !chatData.warnings['1h']) {
                chatData.warnings['1h'] = true;
                await sendGroupMsg('⚠️ *PERINGATAN WAKTU SEWA*\nMasa aktif bot di grup ini tersisa *1 Jam lagi*. Bot akan segera keluar otomatis.');
                global.db.scheduleSave();
            }

            // 5. Sisa 1 Menit
            if (remaining <= MS_1_MIN && remaining > 0 && !chatData.warnings['1m']) {
                chatData.warnings['1m'] = true;
                await sendGroupMsg('🔴 *PERINGATAN AKHIR SEWA*\nMasa aktif bot di grup ini tersisa *1 Menit lagi*! Selamat tinggal semuanya.');
                global.db.scheduleSave();
            }

            // 6. Waktu Habis -> Kirim Pesan & Keluar Grup Otomatis
            if (remaining <= 0) {
                await sendGroupMsg('👋 *MASA SEWA TELAH HABIS*\nWaktu sewa bot telah selesai. Bot keluar dari grup secara otomatis. Terima kasih!\n\n_Ingin perpanjang? Ketik .sewa untuk info paket._');
                
                // Eksekusi keluar grup untuk client terkait
                for (const c of clients) {
                    if (c?.group?.leaveGroup) {
                        try {
                            await c.group.leaveGroup([chatId]);
                        } catch (e) { console.error('[Join Scheduler Leave Error]', chatId, e.message); }
                    }
                }

                delete chatData.joinExpiry;
                delete chatData.warnings;
                delete chatData.joinedAt;
                global.db.scheduleSave();
            }
        }
    }, 15 * 1000); // Check tiap 15 detik
}
