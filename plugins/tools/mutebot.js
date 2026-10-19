const handler = async (m, { text, args, command, isOwner, reply }) => {
    if (!isOwner) {
        return reply('⛔ Perintah ini khusus untuk *Owner bot / Jadibot*!');
    }

    const chatId = m.chat;
    if (!global.db?.data?.chats) global.db.data.chats = {};
    if (!global.db.data.chats[chatId]) global.db.data.chats[chatId] = {};

    const chatData = global.db.data.chats[chatId];
    const cmd = command.toLowerCase();
    const action = (args[0] || '').toLowerCase();

    // Logika unmute
    if (cmd === 'unmutebot' || action === 'off' || action === 'buka' || action === 'unmute') {
        if (!chatData.isMuted) {
            return reply('ℹ️ Bot *tidak dalam kondisi mute* di chat ini.');
        }
        chatData.isMuted = false;
        global.db?.scheduleSave();
        return reply('🔊 *BOT BERHASIL DI-UNMUTE!*\n\nBot sekarang aktif kembali dan dapat merespons perintah di chat ini.');
    }

    // Logika mute
    if (cmd === 'mutebot' || action === 'on' || action === 'mute') {
        if (chatData.isMuted) {
            return reply('ℹ️ Bot *sudah dalam kondisi mute* di chat ini.\n\nKetik *.unmutebot* untuk mengaktifkan kembali.');
        }
        chatData.isMuted = true;
        global.db?.scheduleSave();
        return reply('🔇 *BOT BERHASIL DI-MUTE!*\n\nBot dinonaktifkan di chat ini dan tidak akan merespons pesan/perintah member lain.\n\n_Ketik *.unmutebot* atau *.mutebot off* untuk mengaktifkan kembali._');
    }
};

handler.command = ['mutebot', 'unmutebot'];
handler.help = ['mutebot', 'unmutebot'];
handler.tags = ['tools'];
handler.desc = 'Membungkam / mengaktifkan respon bot di grup atau chat pribadi';
handler.owner = true;
handler.limit = false;
handler.delay = false;

export default handler;
