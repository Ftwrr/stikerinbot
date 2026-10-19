const OFFICIAL_GROUP_1 = 'https://chat.whatsapp.com/FuE56R4VMclGufccHN9RCz';
const OFFICIAL_GROUP_2 = 'https://chat.whatsapp.com/Bek3XeV1a432DMf4xuenRU';

const handler = async (m, { client, from, reply }) => {
    // 1. JIKA DI CHAT PRIBADI (PC / DM)
    if (!m.isGroup) {
        const txt = `🌐 *GRUP RESMI AMBATRON*

Gabung ke grup WhatsApp resmi AMBATRON untuk menikmati fitur terbaru & informasi update:

• *Grup 1:* ${OFFICIAL_GROUP_1}
• *Grup 2:* ${OFFICIAL_GROUP_2}

_Silakan bergabung ke salah satu grup di atas!_`;
        return reply(txt);
    }

    // 2. JIKA DI DALAM GRUP
    try {
        if (!client?.group?.queryInviteCode) {
            return reply('❌ Fitur pengambilan tautan grup tidak didukung oleh client ini.');
        }

        const inviteCode = await client.group.queryInviteCode(from);
        if (!inviteCode) {
            return reply('❌ Gagal mengambil tautan grup. Pastikan bot adalah *Admin* di grup ini!');
        }

        const groupLink = `https://chat.whatsapp.com/${inviteCode}`;
        await reply(`🔗 *TAUTAN GRUP INI:*\n${groupLink}`);
    } catch (err) {
        console.error('[Link Group Error]', err.message);
        if (err.message?.includes('not-authorized') || err.message?.includes('admin') || err.message?.includes('403') || err.message?.includes('401')) {
            return reply('❌ Bot *bukan Admin* di grup ini! Jadikan bot sebagai admin terlebih dahulu untuk mengambil link grup.');
        }
        await reply(`❌ Gagal mengambil tautan grup: ${err.message}`);
    }
};

handler.command = ['link', 'linkgc', 'linkgroup', 'gclink', 'gruplink'];
handler.help = ['link'];
handler.tags = ['group'];
handler.desc = 'Mengambil link undangan grup WhatsApp atau link grup resmi AMBATRON jika di PC';
handler.limit = false;
export default handler;
