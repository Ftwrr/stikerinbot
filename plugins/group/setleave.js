const handler = async (m, { text, usedPrefix, command, reply }) => {
    if (!m.isGroup) {
        return reply('👥 Perintah ini hanya dapat digunakan di dalam grup!');
    }

    if (!global.db?.data?.chats) {
        if (!global.db) global.db = { data: {} };
        if (!global.db.data) global.db.data = {};
        global.db.data.chats = {};
    }

    if (!global.db.data.chats[m.chat]) {
        global.db.data.chats[m.chat] = { isBanned: false, welcome: true, mute: false };
    }

    const chat = global.db.data.chats[m.chat];

    if (!text) {
        const currentCustom = chat.sBye ? `\n\n*Pesan Saat Ini:*\n"${chat.sBye}"` : '\n\n*Pesan Saat Ini:* (Bawaan default bot)';
        return reply(`📝 *PENGATURAN PESAN LEAVE / BYE*

Gunakan perintah ini untuk mengatur teks ucapan perpisahan saat ada member yang keluar/dikeluarkan dari grup.${currentCustom}

*Format Penggunaan:*
${usedPrefix + command} <teks pesan>

*Variabel yang bisa digunakan:*
• *@user* : Men-tag member yang keluar
• *@subject* : Nama/judul grup ini
• *@desc* : Deskripsi grup ini

*Contoh:*
${usedPrefix + command} Selamat tinggal kak @user 👋 Semoga sukses selalu di luar sana!`);
    }

    chat.sBye = text.trim();
    global.db.scheduleSave();

    await reply('✅ *Pesan Leave Berhasil Disimpan!*\n\nPesan perpisahan grup ini telah diperbarui.');
};

handler.command = ['setleave', 'setbye', 'setkeluar'];
handler.category = 'Group';
handler.desc = 'Mengatur teks kustom saat member keluar dari grup';
handler.group = true;
handler.admin = true;
handler.limit = false;
export default handler;
