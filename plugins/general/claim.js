const CLAIM_LIMIT = 5;
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
    const user = global.db.data.users[m.sender];
    if (!user) return reply('User belum terdaftar di database.');

    const now = Date.now();
    const lastClaim = user.lastClaim || 0;
    const diff = now - lastClaim;

    if (diff < COOLDOWN_MS) {
        const remaining = COOLDOWN_MS - diff;
        return reply(`⏳ Kamu sudah melakukan klaim hari ini!\nSilakan tunggu *${formatRemaining(remaining)}* lagi untuk klaim berikutnya.`);
    }

    user.limit = (user.limit || 0) + CLAIM_LIMIT;
    user.lastClaim = now;

    const successText = `🎁 *KLAIM HARIAN BERHASIL!*\n\n• Mendapatkan : *+${CLAIM_LIMIT} Limit*\n• Total Limit  : *${user.limit} Limit*\n\n_Kembali lagi besok untuk klaim limit harianmu!_`;
    const buttons = [
        { id: '.menu', text: '📖 Menu Bot' },
        { id: '.buylimit 1', text: '⚡ Beli Limit' }
    ];

    if (m.sendButtons) {
        return await m.sendButtons(successText, buttons, 'Stikerin Bot • Daily Claim');
    }

    await reply(successText);
};

handler.command = ['claim', 'daily', 'klaim', 'hadiah'];
handler.category = 'General';
handler.limit = false;
handler.desc = 'Klaim bonus 5 limit harian setiap 24 jam';
export default handler;
