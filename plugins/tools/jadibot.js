import { createJadiBotSession, stopJadiBot, listJadiBot } from '../../lib/jadibot_zapo.js';
import { resolvePhoneNumberFromMsg } from '../../lib/lid_helper.js';

const handler = async (msg, { client, from, text, args, command, isOwner, reply, senderJid }) => {
    const cmd = command.toLowerCase();

    // ─── STOP JADIBOT ──────────────────────────────────────────────────────────
    if (cmd === 'stopjadibot' || cmd === 'delsession' || cmd === 'jadibotstop') {
        let targetNumber = text ? text.replace(/[^0-9]/g, '') : '';
        if (!targetNumber) {
            targetNumber = resolvePhoneNumberFromMsg(msg, client) || senderJid.split('@')[0].split(':')[0];
        }
        if (targetNumber.startsWith('08')) targetNumber = '628' + targetNumber.slice(2);

        if (!isOwner && text && targetNumber !== senderJid.split('@')[0]) {
            return reply('⛔ Hanya Owner utama yang dapat mematikan bot milik orang lain!');
        }

        const stopped = await stopJadiBot(targetNumber);
        return reply(
            stopped
                ? `✅ *BERHASIL STOP JADIBOT*\n\nSesi untuk nomor *+${targetNumber}* telah dihentikan, dihapus dari memori, dan file datanya dibersihkan.`
                : `⚠️ Sesi jadibot untuk nomor *+${targetNumber}* tidak ditemukan atau sudah tidak aktif.`
        );
    }

    // ─── LIST JADIBOT ──────────────────────────────────────────────────────────
    if (cmd === 'listjadibot' || cmd === 'jadibotlist') {
        const list = listJadiBot();
        if (list.length === 0) {
            return reply('ℹ️ Belum ada sub-bot / kloning jadibot yang aktif saat ini.');
        }

        let txt = `🤖 *DAFTAR SUB-BOT JADIBOT AKTIF* (${list.length})\n\n`;
        for (const item of list) {
            txt += `• *+${item.number}*\n`;
            txt += `  ➥ Nama: ${item.name}\n`;
            txt += `  ➥ Status: ${item.isOnline ? '🟢 Online' : '🔴 Terputus'}\n`;
            txt += `  ➥ Sesi: ${item.sessionName}\n\n`;
        }
        txt += `_Ketik *.stopjadibot [nomor]* untuk mematikan sesi._`;
        return reply(txt.trim());
    }

    // ─── START / CREATE JADIBOT ────────────────────────────────────────────────
    let mode = 'pairing';
    let targetNumber = '';

    const first = (args[0] || '').toLowerCase();
    const second = args[1] || '';

    if (first === 'scan') {
        mode = 'scan';
        targetNumber = second ? second.replace(/[^0-9]/g, '') : (resolvePhoneNumberFromMsg(msg, client) || senderJid.split('@')[0].split(':')[0]);
    } else if (first === 'pairing') {
        mode = 'pairing';
        targetNumber = second ? second.replace(/[^0-9]/g, '') : (resolvePhoneNumberFromMsg(msg, client) || senderJid.split('@')[0].split(':')[0]);
    } else if (first && /^[0-9]{9,15}$/.test(first)) {
        mode = 'pairing';
        targetNumber = first;
    } else {
        targetNumber = resolvePhoneNumberFromMsg(msg, client) || senderJid.split('@')[0].split(':')[0];
    }

    if (targetNumber.startsWith('08')) targetNumber = '628' + targetNumber.slice(2);

    if (!targetNumber || targetNumber.length < 10) {
        return reply(`⚠️ Format salah!\n\n*Contoh Penggunaan:*\n• *.jadibot 628xxxxxxxxxx* (Pairing Code)\n• *.jadibot scan* (QR Scan)\n• *.jadibot pairing* (Pairing Code nomor pengirim)\n• *.stopjadibot* (Hentikan sesi)\n• *.listjadibot* (Lihat daftar sub-bot)`);
    }

    await reply(`⏳ Sedang menyiapkan sesi *${mode.toUpperCase()}* jadibot untuk nomor *+${targetNumber}*...\n_Proses berlaku selama 30 detik._`);

    try {
        await createJadiBotSession(client, msg, targetNumber, mode);
    } catch (err) {
        console.error('[JadiBot Start Error]', err);
        await reply(`❌ Gagal memulai sesi jadibot: ${err.message}`);
    }
};

handler.command = ['jadibot', 'stopjadibot', 'listjadibot', 'delsession', 'makebot', 'jadibotlist', 'jadibotstop'];
handler.category = 'Tools';
handler.desc = 'Kloning bot jadi sub-bot nomor sendiri';
export default handler;
