const handler = async (m, { isOwner, reply }) => {
    const user = global.db?.data?.users?.[m.sender];
    if (!user) return reply('User belum terdaftar di database.');

    const name = user.name || m.pushName || 'User';
    const level = user.level || 1;
    const exp = user.exp || 0;
    const nextLevelExp = level * 1000;
    const progress = Math.min(100, Math.floor((exp / nextLevelExp) * 100));

    let txt = `📊 *PROFIL PENGGUNA*\n\n` +
        `• Nama  : *${name}*\n` +
        `• Role  : *${isOwner ? '👑 Owner' : 'User'}*\n` +
        `• Level : *${level}*\n` +
        `• EXP   : *${exp.toLocaleString('id-ID')} / ${nextLevelExp.toLocaleString('id-ID')}* (${progress}%)\n\n` +
        `_Dapatkan EXP dengan menggunakan perintah bot secara aktif!_`;

    if (user.banned) {
        let bannedRemaining = 'Permanen';
        const now = Date.now();
        if (user.bannedExpiry && user.bannedExpiry > now) {
            const diffMs = user.bannedExpiry - now;
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            bannedRemaining = days > 0 ? `${days} hari ${hours} jam` : `${hours} jam`;
        }
        txt += `\n• Banned: *Ya (${bannedRemaining})*`;
    }

    await reply(txt);
};

handler.command = ['profile', 'me', 'level', 'exp'];
handler.help = ['profile'];
handler.tags = ['tools'];
handler.desc = 'Cek level, EXP, dan profil pengguna';
export default handler;
