import { jidNormalizedUser, loadRawMessageById } from '../../lib/simple.js';
import { resolvePhoneNumberFromMsg } from '../../lib/lid_helper.js';

function parseDays(val) {
    if (!val) return 30;
    const num = parseInt(val, 10);
    return isNaN(num) || num <= 0 ? 30 : num;
}

function cleanPhoneNumber(input) {
    if (!input) return '';
    let num = String(input).replace(/[^0-9]/g, '');
    if (num.startsWith('08')) num = '628' + num.slice(2);
    return num;
}

async function checkOnWhatsApp(client, jid) {
    if (!client) return { exists: false, jid };
    try {
        if (client.profile?.getProfiles) {
            const res = await client.profile.getProfiles([jid]);
            if (Array.isArray(res) && res.length > 0) {
                const found = res[0];
                if (found && (found.jid || found.status !== undefined || found.error === undefined)) {
                    return { exists: true, jid: found.jid || jid };
                }
            }
        }
    } catch (e) {}

    try {
        if (client.profile?.getStatus) {
            const st = await client.profile.getStatus(jid);
            if (st && st.status !== undefined) return { exists: true, jid };
        }
    } catch (e) {}

    try {
        if (client.profile?.getProfilePicture) {
            const pic = await client.profile.getProfilePicture(jid);
            if (pic) return { exists: true, jid };
        }
    } catch (e) {}

    return { exists: false, jid };
}

const handler = async (m, { client, text, args, command, isOwner, reply }) => {
    const rawText = (text || '').trim();
    const action = (args[0] || '').toLowerCase();

    // 1. ADD USER PREMIUM (Owner Only)
    if (['a', 'add', 'tambah', '+'].includes(action)) {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat menambah status premium!');

        const afterAction = rawText.slice(action.length).trim();
        let targetNum = '';
        let days = 30;

        if (m.quoted) {
            targetNum = cleanPhoneNumber(m.quoted.sender);
            if (!targetNum || targetNum.startsWith('1507') || targetNum.length > 15) {
                targetNum = m.quoted.senderNumber || '';
            }
            if (!targetNum || targetNum.length > 15) {
                targetNum = resolvePhoneNumberFromMsg(m.quoted.key ? { key: m.quoted.key } : null, client) || '';
            }
            if ((!targetNum || targetNum.length > 15) && m.quoted.id) {
                const rawNode = loadRawMessageById(m.quoted.id);
                const pn = rawNode?.rawNode?.attrs?.sender_pn || rawNode?.key?.remoteJidAlt || rawNode?.rawNode?.attrs?.peer_recipient_pn;
                if (pn) targetNum = cleanPhoneNumber(pn);
            }
            days = parseDays(afterAction);
        } else {
            const lastPart = afterAction.split(/\s+/).pop();
            if (lastPart && /^\d{1,4}$/.test(lastPart) && afterAction.split(/\s+/).length > 1 && !afterAction.endsWith(lastPart + ' ')) {
                days = parseInt(lastPart, 10);
                const phonePart = afterAction.slice(0, afterAction.lastIndexOf(lastPart)).trim();
                targetNum = cleanPhoneNumber(phonePart);
            } else {
                targetNum = cleanPhoneNumber(afterAction);
                days = 30;
            }
        }

        if (!targetNum || targetNum.length < 10) {
            return reply('⚠️ Masukkan nomor yang valid atau reply chat target!\n\n*Format:*\n• *.premium add +62 812 1231 1231*\n• *.premium add 0812-1231-1231 30*\n• Reply chat user dengan *.premium add 30*');
        }

        const targetJid = jidNormalizedUser(`${targetNum}@s.whatsapp.net`);
        const waCheck = await checkOnWhatsApp(client, targetJid);
        if (!waCheck.exists) {
            return reply(`❌ Nomor *+${targetNum}* tidak terdaftar di WhatsApp!`);
        }

        const durationMs = days * 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (!global.db.data.users) global.db.data.users = {};
        if (!global.db.data.users[targetJid]) {
            global.db.data.users[targetJid] = {
                name: targetNum,
                limit: 1000,
                exp: 0,
                level: 1,
                premium: true,
                premiumTime: now + durationMs,
                afk: -1,
                afkReason: '',
                banned: false
            };
        } else {
            const currentExp = global.db.data.users[targetJid].premiumTime || 0;
            const baseTime = currentExp > now ? currentExp : now;
            global.db.data.users[targetJid].premium = true;
            global.db.data.users[targetJid].premiumTime = baseTime + durationMs;
            global.db.data.users[targetJid].warned3Days = false;
        }

        global.db.scheduleSave();

        const expDate = new Date(global.db.data.users[targetJid].premiumTime).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Jakarta'
        });

        await reply(`✅ *BERHASIL MENAMBAH PREMIUM*\n\n• User: *+${targetNum}*\n• Durasi: *${days} Hari*\n• Berlaku Hingga: *${expDate}*\n• Benefit: Akses fitur premium & Unlimited Limit!`);
        return;
    }

    // 2. DELETE USER PREMIUM (Owner Only)
    if (['d', 'del', 'delete', 'remove', 'hapus', '-'].includes(action)) {
        if (!isOwner) return reply('⛔ Hanya Owner bot yang dapat menghapus status premium!');

        const afterAction = rawText.slice(action.length).trim();
        let targetNum = m.quoted ? cleanPhoneNumber(m.quoted.sender) : cleanPhoneNumber(afterAction);

        if (!targetNum || targetNum.length < 10) {
            return reply('⚠️ Masukkan nomor target!\nContoh: *.premium del +62 812 1231 1231*');
        }

        const targetJid = jidNormalizedUser(`${targetNum}@s.whatsapp.net`);
        if (global.db.data.users?.[targetJid]) {
            global.db.data.users[targetJid].premium = false;
            global.db.data.users[targetJid].premiumTime = 0;
            global.db.data.users[targetJid].warned3Days = false;
            global.db.scheduleSave();
        }

        await reply(`✅ *STATUS PREMIUM DIHAPUS*\nNomor *+${targetNum}* sekarang kembali menjadi Free User.`);
        return;
    }

    // 3. CEK STATUS ATAU INFO HARGA
    const user = global.db?.data?.users?.[m.sender];
    const isUserPrem = user && (user.premium || (user.premiumTime && user.premiumTime > Date.now()));

    let statusUserText = '';
    if (isUserPrem) {
        const sisaMs = user.premiumTime - Date.now();
        const sisaHari = Math.ceil(sisaMs / (24 * 60 * 60 * 1000));
        const expDate = new Date(user.premiumTime).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
        });
        statusUserText = `👑 *Status Anda:* PREMIUM AKTIF\n⏳ *Sisa Waktu:* ${sisaHari} Hari (${expDate})\n\n`;
    }

    const priceText = `👑 *UPGRADE AKUN PREMIUM*

${statusUserText}Fitur ini untuk nomor pribadi kamu agar menjadi akun Premium (VIP).

💰 *Harga Langganan Akun Pribadi:*
• *30 Hari (1 Bulan)* = Rp 7.000

✨ *Keuntungan Akun Pribadi Premium:*
• ✅ *Unlimited Limit* di chat pribadi (bebas pakai sepuasnya)
• ✅ Respon instan tanpa jeda delay
• ✅ Akses ke fitur khusus Premium

📲 *Cara Beli (Manual ke Owner):*
• Ketik *.sewa* atau hubungi Owner di https://wa.me/${global.owner?.[0] || ''}`;

    await reply(priceText.trim());
};

handler.command = ['premium', 'prem'];
handler.category = 'General';
handler.limit = false;
handler.desc = 'Info harga & manajemen user premium';
export default handler;
