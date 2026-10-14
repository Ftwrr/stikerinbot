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
        const currentCustom = chat.sPromote ? `\n\n*Pesan Saat Ini:*\n"${chat.sPromote}"` : '\n\n*Pesan Saat Ini:* (Bawaan default bot)';
        return reply(`📝 *PENGATURAN PESAN PROMOTE*

Gunakan perintah ini untuk mengatur teks saat ada member yang diangkat menjadi Admin grup.${currentCustom}

*Format Penggunaan:*
${usedPrefix + command} <teks pesan>

*Variabel yang bisa digunakan:*
• *@user* : Men-tag member yang di-promote
• *@subject* : Nama/judul grup ini
• *@desc* : Deskripsi grup ini

*Contoh:*
${usedPrefix + command} 🎉 Selamat @user telah dipromosikan menjadi Admin di @subject!`);
    }

    chat.sPromote = text.trim();
    global.db.scheduleSave();

    await reply('✅ *Pesan Promote Berhasil Disimpan!*\n\nNotifikasi kenaikan admin di grup ini telah diperbarui.');
};

handler.command = ['setpromote', 'setp'];
handler.category = 'Group';
handler.desc = 'Mengatur teks kustom saat member diangkat menjadi Admin grup';
handler.group = true;
handler.admin = true;
handler.limit = false;
export default handler;
