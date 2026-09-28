const handler = async (m, { isOwner, reply }) => {
    const user = global.db.data.users[m.sender];
    if (!user) return reply('User belum terdaftar di database.');

    const statusStr = isOwner ? '👑 Owner' : (user.premium ? '⭐ Premium' : 'Free User');
    const limitStr = isOwner
        ? `♾️ Unlimited (Tersimpan: ${user.limit || 0})`
        : (user.premium ? `♾️ Unlimited (Tersimpan: ${user.limit || 0})` : `${user.limit}`);

    let txt = `📊 *INFORMASI PENGGUNA*

• Nama   : *${user.name || m.pushName || 'User'}*
• Limit  : *${limitStr}*
• Level  : *${user.level || 1}*
• Exp    : *${user.exp || 0}*
• Status : *${statusStr}*`;

    if (user.banned) {
        let bannedRemaining = 'Permanen';
        const now = Date.now();
        if (user.bannedExpiry && user.bannedExpiry > now) {
            const diffMs = user.bannedExpiry - now;
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            bannedRemaining = days > 0 ? `${days} hari ${hours} jam` : `${hours} jam`;
        }
        txt += `\n• Banned : *Ya (${bannedRemaining})*`;
    }

    await reply(txt);
};

handler.command = ['limit', 'ceklimit', 'profile', 'me'];
handler.category = 'General';
handler.limit = false;
handler.desc = 'Cek limit dan data akun di database';
export default handler;
