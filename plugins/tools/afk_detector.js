function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const parts = [];
    if (h > 0) parts.push(`${h} Jam`);
    if (m > 0) parts.push(`${m} Menit`);
    parts.push(`${s} Detik`);
    return parts.join(' ');
}

const handler = async (m) => {
    const text = m.cleanText || m.text || '';
    
    // Jangan proses jika ini perintah .afk itu sendiri
    if (/^[.\/!#$]\s*afk\b/i.test(text)) return false;

    const user = global.db?.data?.users?.[m.sender];

    // 1. CEK JIKA PENGIRIM SEDANG AFK (BERHENTI AFK)
    if (user?.afk && user.afk > 0) {
        const afkDuration = Date.now() - user.afk;
        const reason = user.afkReason || '';

        user.afk = -1;
        user.afkReason = '';
        global.db.scheduleSave();

        const senderNum = m.realPhone || m.senderNumber || m.sender.split('@')[0].split(':')[0];
        const mentionJid = `${senderNum}@s.whatsapp.net`;
        const caption = `👋 *@${senderNum}* telah kembali & berhenti *AFK*${reason ? ` setelah *${reason}*` : ''}\n⏳ *Durasi AFK:* ${formatDuration(afkDuration)}`;

        await m.reply(caption, { mentions: [mentionJid, m.sender] });
    }

    // 2. CEK JIKA ADA USER YANG MENTION ATAU QUOTE ORANG YANG SEDANG AFK
    const targetJids = new Set([
        ...(m.mentionedJid || []),
        ...(m.quoted?.sender ? [m.quoted.sender] : [])
    ]);

    for (const jid of targetJids) {
        if (!jid || jid === m.sender) continue;
        const taggedUser = global.db?.data?.users?.[jid];

        if (taggedUser?.afk && taggedUser.afk > 0) {
            const afkDuration = Date.now() - taggedUser.afk;
            const reason = taggedUser.afkReason || 'Tanpa alasan';
            const taggedNum = jid.split('@')[0].split(':')[0];
            const mentionJid = `${taggedNum}@s.whatsapp.net`;

            const caption = `🤫 Jangan tag *@${taggedNum}*!\n\nDia sedang *AFK*:\n💬 *Alasan:* ${reason}\n⏳ *Sudah berlalu:* ${formatDuration(afkDuration)}`;

            await m.reply(caption, { mentions: [mentionJid, jid] });
            break; // Cukup 1 peringatan per pesan
        }
    }

    return false;
};

handler.custom = true;
export default handler;
