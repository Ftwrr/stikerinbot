const handler = async (m, { args, command, reply }) => {
    const users = global.db?.data?.users || {};
    const cmd = command.toLowerCase();
    const typeArg = (args[0] || '').toLowerCase();

    const isLevelMode = ['toplevel', 'lblevel', 'leaderboardlevel', 'toprank', 'rank'].includes(cmd) || 
                       ['level', 'lvl', 'rank', 'exp'].includes(typeArg);

    const filtered = Object.entries(users).filter(([jid, u]) => {
        if (jid.includes('@lid') || jid.endsWith('@newsletter') || jid.endsWith('@g.us') || jid.endsWith('@hosted') || jid.endsWith('@bot')) {
            return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        return reply('🏆 *LEADERBOARD*\n\nBelum ada data pengguna.');
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    if (isLevelMode) {
        // Urutkan berdasarkan Level tertinggi, lalu EXP tertinggi
        filtered.sort((a, b) => {
            const lvlA = a[1].level || 1;
            const lvlB = b[1].level || 1;
            if (lvlB !== lvlA) return lvlB - lvlA;
            return (b[1].exp || 0) - (a[1].exp || 0);
        });

        const top10 = filtered.slice(0, 10);
        let txt = `🏆 *TOP 10 LEADERBOARD LEVEL & EXP* 🏆\n\n`;

        top10.forEach(([jid, u], index) => {
            let name = (u.name || '').trim();
            if (!name || /^\+?\d+$/.test(name.replace(/[^0-9]/g, '')) || name.includes('@')) {
                name = `Pengguna #${index + 1}`;
            }
            const badge = u.premium ? ' [👑 Prem]' : '';
            const expStr = Number(u.exp || 0).toLocaleString('id-ID');
            const limitStr = Number(u.limit || 0).toLocaleString('id-ID');

            txt += `${medals[index]} *${name}*${badge}\n`;
            txt += `   ➥ Level: *${u.level || 1}* | EXP: *${expStr}* | Limit: *${limitStr}*\n\n`;
        });

        txt += `_Main game seperti *.tebakgambar* untuk mengumpulkan EXP & naik level!_`;
        return reply(txt.trim());
    }

    // Default: Urutkan berdasarkan Limit terbanyak, lalu Level/EXP
    filtered.sort((a, b) => {
        const limitA = a[1].limit || 0;
        const limitB = b[1].limit || 0;
        if (limitB !== limitA) return limitB - limitA;
        const lvlA = a[1].level || 1;
        const lvlB = b[1].level || 1;
        if (lvlB !== lvlA) return lvlB - lvlA;
        return (b[1].exp || 0) - (a[1].exp || 0);
    });

    const top10 = filtered.slice(0, 10);
    let txt = `🏆 *TOP 10 LEADERBOARD LIMIT* 🏆\n\n`;

    top10.forEach(([jid, u], index) => {
        let name = (u.name || '').trim();
        if (!name || /^\+?\d+$/.test(name.replace(/[^0-9]/g, '')) || name.includes('@')) {
            name = `Pengguna #${index + 1}`;
        }
        const badge = u.premium ? ' [👑 Prem]' : '';
        const limitStr = Number(u.limit || 0).toLocaleString('id-ID');
        const expStr = Number(u.exp || 0).toLocaleString('id-ID');

        txt += `${medals[index]} *${name}*${badge}\n`;
        txt += `   ➥ Limit: *${limitStr}* | Level: *${u.level || 1}* (${expStr} EXP)\n\n`;
    });

    txt += `_Ketik *.lb level* untuk melihat peringkat level & EXP tertinggi._`;
    await reply(txt.trim());
};

handler.command = ['lb', 'leaderboard', 'toplimit', 'top', 'toplevel', 'toprank', 'rank', 'lblevel'];
handler.category = 'General';
handler.limit = false;
handler.desc = 'Menampilkan 10 pengguna peringkat tertinggi (Limit atau Level/EXP)';
export default handler;
