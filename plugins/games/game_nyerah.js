import { removeActiveGame } from '../../lib/game_manager.js';

const handler = async (m, { client, from, reply }) => {
    global.game = global.game || {};

    if (!global.game[from]) {
        return reply('⚠️ Tidak ada game yang sedang berjalan di chat ini.');
    }

    const game = global.game[from];
    clearTimeout(game.timeout);

    // Hapus gambar soal yang tadi dikirim jika ada
    if (game.imgMsgId) {
        await client.sendMessage(from, { delete: { id: game.imgMsgId, fromMe: true } }).catch(() => {});
    }

    const txt = `🏳️ *MENYERAH*

Kamu telah menyerah dari game ini. Jawaban dirahasiakan! 🤐

Ingin coba lagi? Ketik *.${game.type}*`;

    delete global.game[from];
    removeActiveGame(from);

    const buttons = [{ id: `.${game.type}`, text: `🎮 Main ${game.type}` }];
    let sentRes;
    if (m.sendButtons) {
        sentRes = await m.sendButtons(txt, buttons, 'Game • Menyerah');
    } else {
        sentRes = await m.reply(txt);
    }

    if (sentRes?.id || sentRes?.key?.id) {
        global.gameHistory = global.gameHistory || new Map();
        global.gameHistory.set(from, sentRes.id || sentRes.key.id);
    }
};

handler.command = ['nyerah', 'menyerah', 'surrender'];
handler.category = 'Games';
handler.desc = 'Menyerah dari game tebak gambar / kuis yang sedang berjalan (Biaya: 1 Limit)';
handler.limit = 1;
export default handler;
