import { resolvePhoneNumberFromMsg } from '../../lib/lid_helper.js';

function cleanPhone(input) {
    if (!input) return '';
    let num = String(input).replace(/[^0-9]/g, '');
    if (num.startsWith('08')) num = '628' + num.slice(2);
    return num;
}

const handler = async (m, { client, from, text, isOwner, reply }) => {
    if (!isOwner) {
        return reply('⛔ Pembukaan ban dilakukan manual oleh Owner. Silakan hubungi Owner bot.');
    }

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
        return reply('⚠️ Masukkan nomor target atau reply pesan target dengan *.unban <nomor>*');
    }

    const targetJid = `${targetNum}@s.whatsapp.net`;
    if (global.db.data?.users?.[targetJid]) {
        global.db.data.users[targetJid].banned = false;
        global.db.scheduleSave();
    }
    return reply(`✅ *BERHASIL BUKA BANNED*\n\nNomor *+${targetNum}* sekarang sudah tidak dibanned.`);
};

handler.command = ['unban', 'unbanned', 'lepasban', 'bukaunban'];
handler.help = ['unban @user'];
handler.tags = ['owner'];
handler.desc = 'Membuka status banned akun (Khusus Owner)';
handler.owner = true;
handler.limit = false;
export default handler;
