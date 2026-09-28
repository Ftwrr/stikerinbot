const handler = async (m, { text, reply }) => {
    const user = global.db?.data?.users?.[m.sender];
    if (!user) return reply('User belum terdaftar di database.');

    const reason = text.trim();
    user.afk = Date.now();
    user.afkReason = reason;
    global.db.scheduleSave();

    const senderNum = m.realPhone || m.senderNumber || m.sender.split('@')[0].split(':')[0];
    const mentionJid = `${senderNum}@s.whatsapp.net`;
    const caption = `😴 *@${senderNum}* sekarang *AFK* (Away From Keyboard)${reason ? `\n💬 *Alasan:* ${reason}` : ''}`;

    await m.reply(caption, { mentions: [mentionJid, m.sender] });
};

handler.command = ['afk'];
handler.limit = 1;
export default handler;
