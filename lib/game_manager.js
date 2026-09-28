/**
 * Helper untuk sinkronisasi state game aktif ke SQLite & auto-restore saat booting
 */
export function saveActiveGame(chatJid, gameData) {
    if (!global.db?.data?.games) {
        if (global.db && !global.db.data.games) global.db.data.games = {};
    }
    if (global.db?.data?.games) {
        // Jangan simpan timeout handle (non-serializable)
        const { timeout, ...persistable } = gameData;
        global.db.data.games[chatJid] = persistable;
        global.db.scheduleSave();
    }
}

export function removeActiveGame(chatJid) {
    if (global.db?.data?.games?.[chatJid]) {
        delete global.db.data.games[chatJid];
        global.db.scheduleSave();
    }
}

export function restoreActiveGames(client) {
    if (!global.db?.data?.games) return;
    const now = Date.now();
    const GAME_TIMEOUT_MS = 180000; // 3 Menit

    global.game = global.game || {};

    for (const [chatJid, gData] of Object.entries(global.db.data.games)) {
        if (!gData || !gData.jawaban) continue;
        const elapsed = now - (gData.waktu || now);
        const remaining = GAME_TIMEOUT_MS - elapsed;

        if (remaining <= 0) {
            // Sudah expired saat bot mati, bersihkan
            delete global.db.data.games[chatJid];
            delete global.game[chatJid];
            continue;
        }

        console.log(`[Game Restorer] 🎮 Memulihkan sesi ${gData.type} di ${chatJid} (Sisa waktu: ${Math.round(remaining / 1000)}s)`);

        global.game[chatJid] = {
            ...gData,
            timeout: setTimeout(async () => {
                if (global.game[chatJid]) {
                    if (gData.imgMsgId) {
                        await client.sendMessage(chatJid, { delete: { id: gData.imgMsgId, fromMe: true } }).catch(() => {});
                    }
                    const timeoutRes = await client.sendMessage(chatJid, {
                        text: `⏰ *Waktu Habis!*

Tidak ada yang berhasil menjawab tepat waktu.

Ingin coba lagi? Ketik *.${gData.type || 'tebakgambar'}*`
                    }).catch(() => {});

                    if (timeoutRes?.id || timeoutRes?.key?.id) {
                        global.gameHistory = global.gameHistory || new Map();
                        global.gameHistory.set(chatJid, timeoutRes.id || timeoutRes.key.id);
                    }
                    delete global.game[chatJid];
                    removeActiveGame(chatJid);
                }
            }, remaining)
        };
    }
    global.db.scheduleSave();
}
