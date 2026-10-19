const handler = async (m, { reply }) => {
    const users = global.db?.data?.users || {};

    const filtered = Object.entries(users).filter(([jid]) => {
        if (!jid || jid.includes('@lid') || jid.endsWith('@newsletter') || jid.endsWith('@g.us') || jid.endsWith('@hosted') || jid.endsWith('@bot')) {
            return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        return reply('🏆 *LEADERBOARD LEVEL*\n\nBelum ada data pengguna.');
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

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
        const expStr = Number(u.exp || 0).toLocaleString('id-ID');

        txt += `${medals[index]} *${name}*\n`;
        txt += `   ➥ Level: *${u.level || 1}* | EXP: *${expStr}*\n\n`;
    });

    txt += `_Gunakan bot secara aktif untuk mengumpulkan EXP & naik level!_`;
    await reply(txt.trim());
};

handler.command = ['lb', 'leaderboard', 'top', 'rank', 'toprank', 'toplevel', 'lblevel'];
handler.category = 'General';
handler.desc = 'Menampilkan 10 pengguna peringkat level & EXP tertinggi';
export default handler;
