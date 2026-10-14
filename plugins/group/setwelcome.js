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
        const currentCustom = chat.sWelcome ? `\n\n*Pesan Saat Ini:*\n"${chat.sWelcome}"` : '\n\n*Pesan Saat Ini:* (Bawaan default bot)';
        return reply(`📝 *PENGATURAN PESAN WELCOME*

Gunakan perintah ini untuk mengatur teks sambutan member baru.${currentCustom}

*Format Penggunaan:*
${usedPrefix + command} <teks pesan>

*Variabel yang bisa digunakan:*
• *@user* : Men-tag member yang baru bergabung
• *@subject* : Nama/judul grup ini
• *@desc* : Deskripsi grup ini

*Contoh:*
${usedPrefix + command} Halo kak @user! Selamat datang di @subject. Jangan lupa baca deskripsi ya:
@desc`);
    }

    chat.sWelcome = text.trim();
    chat.welcome = true;
    global.db.scheduleSave();

    await reply('✅ *Pesan Welcome Berhasil Disimpan!*\n\nFitur welcome di grup ini otomatis diaktifkan.');
};

handler.command = ['setwelcome', 'setw'];
handler.category = 'Group';
handler.desc = 'Mengatur teks kustom sambutan member baru di grup';
handler.group = true;
handler.admin = true;
handler.limit = false;
export default handler;
