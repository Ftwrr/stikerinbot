const handler = async (m, { client, from, reply }) => {
    const ownerList = Array.isArray(global.owner) ? global.owner : [];
    const ownerNum = ownerList[0];

    if (!ownerNum) {
        return reply('⚠️ Nomor owner belum dikonfigurasi di file .env');
    }

    const cleanNum = String(ownerNum).replace(/[^0-9]/g, '');
    const displayName = 'Owner AMBATRON';
    const vcard = 'BEGIN:VCARD\n'
        + 'VERSION:3.0\n'
        + `FN:${displayName}\n`
        + 'ORG:AMBATRON\n'
        + `TEL;type=CELL;type=VOICE;waid=${cleanNum}:+${cleanNum}\n`
        + 'END:VCARD';

    try {
        await client.sendMessage(from, {
            contactMessage: {
                displayName,
                vcard
            }
        }, { quoted: { key: m.key } });
    } catch (err) {
        console.error('[Owner Contact Error]', err.message);
        await reply(`👤 *Kontak Owner:* wa.me/${cleanNum}`);
    }
};

handler.command = ['owner', 'creator', 'pemilik'];
handler.category = 'General';
handler.desc = 'Mengirim kartu kontak WhatsApp owner bot';
handler.limit = false;
export default handler;
