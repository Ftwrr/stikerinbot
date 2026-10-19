import { resolvePhoneNumberFromMsg } from '../../lib/lid_helper.js';

function cleanPhone(input) {
    if (!input) return '';
    let num = String(input).replace(/[^0-9]/g, '');
    if (num.startsWith('08')) num = '628' + num.slice(2);
    return num;
}

const handler = async (m, { client, from, text, args, isOwner, reply }) => {
    if (!isOwner) return reply('⛔ Perintah ini khusus untuk Owner bot!');

    let targetNum = '';

    if (m.quoted) {
        targetNum = cleanPhone(m.quoted.sender);
        if (!targetNum || targetNum.startsWith('1507') || targetNum.length > 15) {
            targetNum = m.quoted.senderNumber || '';
        }
        if (!targetNum || targetNum.length > 15) {
            targetNum = resolvePhoneNumberFromMsg(m.quoted.key ? { key: m.quoted.key } : null, client) || '';
        }
    } else if (text) {
        targetNum = cleanPhone(text);
    }

    if (!targetNum || targetNum.length < 10) {
        return reply(`⚠️ Masukkan nomor target atau reply pesan user!\n\n*Contoh:*\n• *.ban 628123456789*\n• Reply pesan user dengan *.ban*`);
    }

    const targetJid = `${targetNum}@s.whatsapp.net`;

    if (!global.db.data.users) global.db.data.users = {};
    if (!global.db.data.users[targetJid]) {
        global.db.data.users[targetJid] = { name: targetNum, limit: 20, exp: 0, level: 1, premium: false, banned: true };
    } else {
        global.db.data.users[targetJid].banned = true;
    }
    global.db.scheduleSave();

    await reply(`🚫 *USER BERHASIL DIBANNED*\n\n• Target : *+${targetNum}*\n• Status : *Banned (Akses bot ditolak)*\n\n_Untuk membuka: *.unban +${targetNum}*_`);
};

handler.command = ['ban', 'banned', 'banuser'];
handler.help = ['ban @user'];
handler.tags = ['owner'];
handler.desc = 'Memblokir akses pengguna dari menggunakan perintah bot';
handler.owner = true;
export default handler;
