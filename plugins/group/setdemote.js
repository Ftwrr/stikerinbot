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
        const currentCustom = chat.sDemote ? `\n\n*Pesan Saat Ini:*\n"${chat.sDemote}"` : '\n\n*Pesan Saat Ini:* (Bawaan default bot)';
        return reply(`📝 *PENGATURAN PESAN DEMOTE*

Gunakan perintah ini untuk mengatur teks saat ada Admin yang diturunkan jabatannya menjadi member biasa.${currentCustom}

*Format Penggunaan:*
${usedPrefix + command} <teks pesan>

*Variabel yang bisa digunakan:*
• *@user* : Men-tag member yang di-demote
• *@subject* : Nama/judul grup ini
• *@desc* : Deskripsi grup ini

*Contoh:*
${usedPrefix + command} 📉 Jabatan admin @user telah diturunkan menjadi Member biasa di @subject.`);
    }

    chat.sDemote = text.trim();
    global.db.scheduleSave();

    await reply('✅ *Pesan Demote Berhasil Disimpan!*\n\nNotifikasi penurunan admin di grup ini telah diperbarui.');
};

handler.command = ['setdemote', 'setd'];
handler.category = 'Group';
handler.desc = 'Mengatur teks kustom saat admin diturunkan menjadi member biasa di grup';
handler.group = true;
handler.admin = true;
handler.limit = false;
export default handler;
