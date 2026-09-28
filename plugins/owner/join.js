const INVITE_REGEX = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
const DEFAULT_DAYS = 30;

function parseDays(val) {
    if (!val) return DEFAULT_DAYS;
    const n = parseInt(val, 10);
    return isNaN(n) || n <= 0 ? DEFAULT_DAYS : n;
}

const handler = async (m, { client, text, args, isOwner, reply }) => {
    if (!isOwner) {
        return reply('⛔ Perintah ini khusus untuk Owner bot!');
    }

    const input = (text || m.quoted?.text || '').trim();
    const match = input.match(INVITE_REGEX);

    if (!match) {
        return reply(`⚠️ Masukkan tautan/link undangan grup WhatsApp yang valid!\n\n*Contoh:*\n• *.join https://chat.whatsapp.com/L1234567890ABCDEF12345*\n• *.join https://chat.whatsapp.com/L1234567890ABCDEF12345 30* (Custom hari)`);
    }

    const inviteCode = match[1];
    const days = parseDays(args[1]);
    const durationMs = days * 24 * 60 * 60 * 1000;
    const expiryTime = Date.now() + durationMs;

    try {
        if (!client?.group?.joinGroupViaInvite) {
            return reply('❌ Fitur join grup tidak didukung oleh instance client ini.');
        }

        const res = await client.group.joinGroupViaInvite(inviteCode);
        const groupJid = res?.jid || res?.id || (typeof res === 'string' ? res : '');

        if (!groupJid) {
            return reply('✅ Permintaan bergabung grup telah dikirimkan / diproses.');
        }

        // Simpan data sewa grup di database
        if (!global.db.data.chats[groupJid]) {
            global.db.data.chats[groupJid] = {};
        }

        global.db.data.chats[groupJid].joinExpiry = expiryTime;
        global.db.data.chats[groupJid].joinedAt = Date.now();
        global.db.data.chats[groupJid].durationDays = days;
        global.db.data.chats[groupJid].warnings = {};
        global.db.scheduleSave();

        const expDate = new Date(expiryTime).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Jakarta'
        });

        // Kirim notifikasi konfirmasi ke chat pemanggil
        await reply(`🎉 *BOT BERHASIL MASUK GRUP!*\n\n• Target JID : *${groupJid}*\n• Masa Sewa  : *${days} Hari*\n• Expired Pada: *${expDate}*\n\n_Bot akan otomatis memberikan notifikasi countdown (H-3, H-2, H-1, 1 jam, 1 menit) dan keluar otomatis saat waktu habis._`);

        // Kirim salam perkenalan ke dalam grup yang dimasuki
        try {
            await client.sendMessage(groupJid, {
                text: `👋 *Halo semuanya!*\n\nBot telah diundang masuk oleh Owner untuk aktif selama *${days} Hari* (Hingga ${expDate}).\nKetik *.menu* untuk melihat daftar fitur yang tersedia.`
            });
        } catch (e) {}

    } catch (err) {
        console.error('[Join Group Error]', err);
        await reply(`❌ Gagal masuk grup: ${err.message || 'Link invite mungkin sudah di-reset atau bot telah di-kick.'}`);
    }
};

handler.command = ['join', 'joingc', 'masuk'];
handler.category = 'Owner';
handler.desc = 'Memasukkan bot ke grup dengan auto-leave timer 30 hari';
handler.owner = true;
export default handler;
