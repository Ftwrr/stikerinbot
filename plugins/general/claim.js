const CLAIM_EXP = 100;
const COOLDOWN_HOURS = 24;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

function formatRemaining(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours} jam ${mins} menit ${secs} detik`;
}

const handler = async (m, { reply }) => {
    if (!global.db?.data?.users) return reply('Database pengguna belum siap.');
    const user = global.db.data.users[m.sender];
    if (!user) return reply('User belum terdaftar di database.');

    const now = Date.now();
    const lastClaim = user.lastClaim || 0;
    const diff = now - lastClaim;

    if (diff < COOLDOWN_MS) {
        const remaining = COOLDOWN_MS - diff;
        return reply(`⏳ Kamu sudah melakukan klaim hari ini!\nSilakan tunggu *${formatRemaining(remaining)}* lagi untuk klaim berikutnya.`);
    }

    user.exp = (user.exp || 0) + CLAIM_EXP;
    user.lastClaim = now;

    const currentLevel = user.level || 1;
    const neededExp = currentLevel * 1000;
    let levelUpText = '';

    if (user.exp >= neededExp) {
        user.level = currentLevel + 1;
        levelUpText = `\n🆙 *LEVEL UP!* Selamat, kamu naik ke *Level ${user.level}*!`;
    }

    global.db.scheduleSave();

    const successText = `🎁 *KLAIM HARIAN BERHASIL!*\n\n` +
        `• Bonus Didapat : *+${CLAIM_EXP} EXP*\n` +
        `• Level Sekarang: *${user.level || 1}*\n` +
        `• Total EXP     : *${user.exp.toLocaleString('id-ID')} EXP*` +
        levelUpText +
        `\n\n_Kembali lagi besok untuk klaim bonus harian berikutnya!_`;

    const buttons = [
        { id: '.menu', text: '📖 Menu Bot' },
        { id: '.profile', text: '📊 Cek Profil' },
        { id: '.lb', text: '🏆 Leaderboard' }
    ];

    if (m.sendButtons) {
        return await m.sendButtons(successText, buttons, 'Stikerin Bot • Daily Claim');
    }

    await reply(successText);
};

handler.command = ['claim', 'daily', 'klaim', 'hadiah'];
handler.category = 'General';
handler.desc = 'Klaim bonus 100 EXP harian setiap 24 jam';
export default handler;
