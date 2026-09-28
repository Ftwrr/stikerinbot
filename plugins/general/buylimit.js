const EXP_PER_LIMIT = 200;

const handler = async (m, { text, args, isOwner, reply }) => {
    const user = global.db?.data?.users?.[m.sender];
    if (!user) return reply('User belum terdaftar di database.');

    if (isOwner || user.premium) {
        return reply('👑 Status akun kamu sudah *Unlimited Limit*, tidak perlu membeli limit.');
    }

    let count = parseInt(args[0], 10);
    if (isNaN(count) || count <= 0) {
        return reply(`🛒 *PEMBELIAN LIMIT VIA EXP*

• Kurs : *${EXP_PER_LIMIT} EXP = 1 Limit*
• EXP Kamu : *${user.exp || 0} EXP*
• Limit Kamu : *${user.limit || 0} Limit*

*Cara Beli:*
Ketik *.buylimit <jumlah>*
_Contoh: *.buylimit 5* (Butuh ${5 * EXP_PER_LIMIT} EXP)_
_Atau ketik *.buylimit all* untuk tukar semua EXP._`);
    }

    if (args[0]?.toLowerCase() === 'all' || args[0]?.toLowerCase() === 'semua') {
        count = Math.floor((user.exp || 0) / EXP_PER_LIMIT);
        if (count <= 0) {
            return reply(`⚠️ EXP kamu (*${user.exp || 0}*) tidak mencukupi untuk membeli 1 limit (Butuh minimal ${EXP_PER_LIMIT} EXP).`);
        }
    }

    const totalCost = count * EXP_PER_LIMIT;
    if ((user.exp || 0) < totalCost) {
        return reply(`⚠️ EXP kamu tidak cukup!\n\n• Mau beli: *${count} Limit*\n• Butuh: *${totalCost} EXP*\n• EXP Kamu: *${user.exp || 0} EXP*\n\n_Dapatkan EXP dari bermain game (misal: *.tebakgambar*)._`);
    }

    user.exp -= totalCost;
    user.limit = (user.limit || 0) + count;
    global.db.scheduleSave();

    const txt = `✅ *PEMBELIAN LIMIT BERHASIL!*

• Membeli : *+${count} Limit*
• Biaya   : *-${totalCost} EXP*
• Sisa EXP : *${user.exp} EXP*
• Total Limit : *${user.limit} Limit*`;

    await reply(txt);
};

handler.command = ['buylimit', 'belilimit', 'buyl', 'belil'];
handler.category = 'General';
handler.limit = false;
handler.desc = 'Menukar EXP hasil bermain game menjadi kuota limit (200 EXP = 1 Limit)';
export default handler;
