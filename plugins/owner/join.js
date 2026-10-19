const INVITE_REGEX = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;

const handler = async (m, { client, text, isOwner, reply }) => {
    if (!isOwner) {
        return reply('⛔ Perintah ini khusus untuk Owner bot!');
    }

    const input = (text || m.quoted?.text || '').trim();
    const match = input.match(INVITE_REGEX);

    if (!match) {
        return reply(`⚠️ Masukkan tautan/link undangan grup WhatsApp yang valid!\n\n*Contoh:*\n• *.join https://chat.whatsapp.com/L1234567890ABCDEF12345*`);
    }

    const inviteCode = match[1];

    try {
        if (!client?.group?.joinGroupViaInvite) {
            return reply('❌ Fitur join grup tidak didukung oleh instance client ini.');
        }

        const res = await client.group.joinGroupViaInvite(inviteCode);
        const groupJid = res?.jid || res?.id || (typeof res === 'string' ? res : '');

        if (!groupJid) {
            return reply('✅ Permintaan bergabung grup telah dikirimkan / diproses.');
        }

        if (!global.db.data.chats[groupJid]) {
            global.db.data.chats[groupJid] = {};
        }
        global.db.data.chats[groupJid].joinedAt = Date.now();
        global.db.scheduleSave();

        await reply(`🎉 *BOT BERHASIL MASUK GRUP!*\n\n• Target JID : *${groupJid}*`);

        try {
            await client.sendMessage(groupJid, {
                text: `👋 *Halo semuanya!*\n\nBot telah berhasil bergabung ke dalam grup.\nKetik *.menu* untuk melihat daftar fitur yang tersedia.`
            });
        } catch (e) {}

    } catch (err) {
        console.error('[Join Group Error]', err);
        await reply(`❌ Gagal masuk grup: ${err.message || 'Link invite mungkin sudah di-reset atau bot telah di-kick.'}`);
    }
};

handler.command = ['join', 'joingc', 'masuk'];
handler.category = 'Owner';
handler.desc = 'Memasukkan bot ke grup via link undangan';
handler.owner = true;
export default handler;
