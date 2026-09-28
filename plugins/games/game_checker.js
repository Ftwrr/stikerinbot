import { removeActiveGame } from '../../lib/game_manager.js';

function similarity(s1, s2) {
    let longer = s1.toLowerCase();
    let shorter = s2.toLowerCase();
    if (s1.length < s2.length) {
        longer = s2.toLowerCase();
        shorter = s1.toLowerCase();
    }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

const handler = async (m, { client, from }) => {
    if (!global.game || !global.game[from]) return false;

    const game = global.game[from];
    const text = (m.cleanText || m.text || '').toLowerCase().trim();

    if (!text || text.startsWith('.') || text.startsWith('!') || text.startsWith('/') || text.startsWith('#') || text.startsWith('$')) {
        return false;
    }

    const targetJawaban = game.jawaban.toLowerCase().trim();

    // 1. JAWABAN BENAR
    if (text === targetJawaban) {
        clearTimeout(game.timeout);
        delete global.game[from];
        removeActiveGame(from);

        // Hapus gambar soal yang tadi dikirim
        if (game.imgMsgId) {
            await client.sendMessage(from, { delete: { id: game.imgMsgId, fromMe: true } }).catch(() => {});
        }

        if (m.react) await m.react('✅');

        const user = global.db?.data?.users?.[m.sender];
        const rewardExp = game.poin || 20; // EXP dikit agar tidak gampang naik level
        let lvlMsg = '';

        if (user) {
            user.exp = (user.exp || 0) + rewardExp;
            const currentLevel = user.level || 1;
            const neededExp = currentLevel * 1000;
            if (user.exp >= neededExp) {
                user.level = currentLevel + 1;
                user.limit = (user.limit || 0) + 5;
                lvlMsg = `\n🆙 *LEVEL UP!* Naik ke Level *${user.level}* (+5 Bonus Limit)`;
            }
            global.db?.scheduleSave();
        }

        const rewardTxt = `🎉 *TEBAKAN BENAR!*

Selamat tebakanmu benar: *${game.jawaban.toUpperCase()}* 👏
🎁 Hadiah: *+${rewardExp} EXP*${lvlMsg}
${game.deskripsi ? `\n💡 *Penjelasan:* ${game.deskripsi}` : ''}

_Tukar EXP menjadi limit dengan *.buylimit*_
Ingin main lagi? Ketik *.${game.type}*`;

        const sentRes = await m.reply(rewardTxt);
        if (sentRes?.id || sentRes?.key?.id) {
            global.gameHistory = global.gameHistory || new Map();
            global.gameHistory.set(from, sentRes.id || sentRes.key.id);
        }
        return true;
    }

    // 2. JAWABAN HAMPIR BENAR (SIMILARITY >= 70%)
    const simScore = similarity(text, targetJawaban);
    if (simScore >= 0.70) {
        if (m.react) await m.react('🤏');
        return true;
    }

    // 3. JAWABAN SALAH (Tidak diberi react)
    return false;
};

handler.custom = true;
export default handler;
