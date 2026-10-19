const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VALIDATE_DELAY = 1000; // jeda antar validasi nomor (ms)
const SEND_DELAY = 5000;     // jeda antar pengiriman pesan (ms)
const PROGRESS_EVERY = 5;    // update progress validasi tiap N nomor

function cleanPhoneNumber(input) {
    if (!input) return '';
    let num = String(input).replace(/[^0-9]/g, '');
    if (num.startsWith('08')) num = '628' + num.slice(2);
    else if (num.startsWith('8')) num = '628' + num.slice(1);
    else if (num.startsWith('6208')) num = '628' + num.slice(4);
    return num;
}

/**
 * Cek apakah nomor terdaftar di WhatsApp via profile API Zapo
 */
async function checkWhatsAppRegistered(client, jid) {
    if (!client) return false;
    try {
        if (client.profile?.getProfiles) {
            const res = await client.profile.getProfiles([jid]);
            if (Array.isArray(res) && res.length > 0) {
                const found = res[0];
                if (found && (found.jid || found.status !== undefined || found.error === undefined)) {
                    return true;
                }
            }
        }
    } catch (e) {}

    try {
        if (client.profile?.getStatus) {
            const st = await client.profile.getStatus(jid);
            if (st && st.status !== undefined) return true;
        }
    } catch (e) {}

    try {
        if (client.profile?.getProfilePicture) {
            const pic = await client.profile.getProfilePicture(jid);
            if (pic) return true;
        }
    } catch (e) {}

    return false;
}

const handler = async (m, { client, from, text, args, isOwner, reply }) => {
    if (!isOwner) return reply('⛔ Perintah ini khusus untuk Owner bot!');

    const raw = text.trim();
    const q = m.quoted || null;

    if (!raw) {
        return reply(`📢 *PENGIRIMAN PESAN MULTI-NOMOR*

*Cara Penggunaan:*
1. Balas (reply) pesan teks/media yang mau dikirim dengan perintah:
   *.pinjol*
   *82375888515*
   *8558120302*
   *82170626510*

2. Atau dalam satu teks:
   *.pinjol [08123456789, 08571234567] Pesan yang ingin dikirim*

_Maksimal 20 nomor per panggilan. Bot otomatis memvalidasi apakah nomor terdaftar di WhatsApp dengan jeda 5 detik antar pengiriman (anti spam)._`);
    }

    let rawNumbers = [];
    let messageText = '';

    // Format 1: Bracket [nomor1, nomor2, ...] <pesan opsional>
    const bracketMatch = raw.match(/^\[(.*?)\]\s*(.*)$/s);
    if (bracketMatch) {
        rawNumbers = bracketMatch[1].split(/[\r\n,;]+/).filter(Boolean);
        messageText = bracketMatch[2].trim();
    } else {
        // Format 2: Baris per baris nomor telepon (mendukung +62 858-1415-3319)
        const lines = raw.split(/[\r\n,;]+/).map(l => l.trim()).filter(Boolean);
        const numbersFound = [];
        const extraWords = [];

        for (const line of lines) {
            const clean = cleanPhoneNumber(line);
            // Cek apakah baris ini adalah nomor telepon
            if (clean.length >= 10 && clean.length <= 15 && /^[0-9]+$/.test(clean)) {
                numbersFound.push(clean);
            } else {
                extraWords.push(line);
            }
        }
        rawNumbers = numbersFound;
        messageText = extraWords.join('\n').trim();
    }

    // Jika pesan tidak ada di argumen, ambil dari pesan yang di-reply (quoted)
    if (!messageText && q) {
        messageText = q.text || q.caption || '';
    }

    if (!messageText && !q) {
        return reply('⚠️ Masukkan teks pesan atau balas (reply) pesan/media yang ingin dikirimkan!');
    }

    const cleaned = rawNumbers.map(cleanPhoneNumber).filter(n => n && n.length >= 10 && n.length <= 15);
    const countMap = {};
    cleaned.forEach(n => countMap[n] = (countMap[n] || 0) + 1);
    const uniqueNumbers = Object.keys(countMap);
    const duplicates = Object.entries(countMap).filter(([, c]) => c > 1).map(([n, c]) => ({ num: n, count: c }));

    if (uniqueNumbers.length === 0) {
        return reply('⚠️ Tidak ada nomor telepon valid yang ditemukan dalam teks.');
    }

    if (uniqueNumbers.length > 20) {
        return reply(`⚠️ Maksimal 20 nomor per pengiriman! (Terdeteksi ${uniqueNumbers.length} nomor unik). Silakan kurangi daftar nomor.`);
    }

    if (m.react) await m.react('⏳');

    const startedAt = Date.now();
    const totalEstimate = Math.ceil((uniqueNumbers.length * VALIDATE_DELAY + uniqueNumbers.length * SEND_DELAY) / 1000);
    let statusMsg = `🔍 Sedang memvalidasi *${uniqueNumbers.length} nomor* ke server WhatsApp & mengirim pesan...\n`;
    statusMsg += `⏱️ Estimasi selesai: ± *${totalEstimate} detik* (${uniqueNumbers.length} nomor × ${SEND_DELAY / 1000} detik jeda)`;
    if (duplicates.length > 0) {
        statusMsg += `\n🔁 Terdeteksi *${duplicates.length} nomor duplikat* (otomatis digabung)`;
    }
    await reply(statusMsg);

    const validTargets = [];
    const notRegistered = [];
    let success = 0;
    let failed = 0;

    // 1. Validasi keberadaan nomor di WhatsApp (dengan jeda + estimasi sisa waktu)
    for (let i = 0; i < uniqueNumbers.length; i++) {
        const num = uniqueNumbers[i];
        const targetJid = `${num}@s.whatsapp.net`;
        const exists = await checkWhatsAppRegistered(client, targetJid);
        if (exists) {
            validTargets.push(num);
        } else {
            notRegistered.push(num);
        }

        const done = i + 1;
        const remainNumbers = uniqueNumbers.length - done;
        if ((done % PROGRESS_EVERY === 0 || done === uniqueNumbers.length) && remainNumbers > 0) {
            const remainSec = Math.ceil((remainNumbers * (VALIDATE_DELAY + SEND_DELAY)) / 1000);
            await reply(`⏳ Validasi *${done}/${uniqueNumbers.length}* nomor... perkiraan sisa ± *${remainSec} detik*`);
        }
        if (remainNumbers > 0) await delay(VALIDATE_DELAY);
    }

    // 2. Kirim pesan hanya ke nomor yang terdaftar
    for (let i = 0; i < validTargets.length; i++) {
        const num = validTargets[i];
        const targetJid = `${num}@s.whatsapp.net`;
        try {
            if (q && (q.mtype === 'imageMessage' || q.msg?.imageMessage)) {
                const imgBuf = await q.download();
                await client.sendMessage(targetJid, {
                    image: imgBuf,
                    caption: messageText || q.text || ''
                });
            } else if (q && (q.mtype === 'videoMessage' || q.msg?.videoMessage)) {
                const vidBuf = await q.download();
                await client.sendMessage(targetJid, {
                    video: vidBuf,
                    caption: messageText || q.text || ''
                });
            } else if (q && (q.mtype === 'documentMessage' || q.msg?.documentMessage)) {
                const docBuf = await q.download();
                await client.sendMessage(targetJid, {
                    document: docBuf,
                    mimetype: q.msg?.mimetype || 'application/octet-stream',
                    fileName: q.msg?.fileName || 'document',
                    caption: messageText || q.text || ''
                });
            } else if (q && (q.mtype === 'stickerMessage' || q.msg?.stickerMessage)) {
                const stkBuf = await q.download();
                await client.sendMessage(targetJid, { sticker: stkBuf });
                if (messageText) {
                    await client.sendMessage(targetJid, { text: messageText });
                }
            } else {
                await client.sendMessage(targetJid, {
                    text: messageText
                });
            }
            success++;
        } catch (err) {
            console.error(`[MultiSend Error: ${num}]`, err.message);
            failed++;
        }

        const doneSend = i + 1;
        const remainCount = validTargets.length - doneSend;
        if (remainCount > 0 && (doneSend % PROGRESS_EVERY === 0)) {
            await reply(`📤 Terkirim *${doneSend}/${validTargets.length}* nomor... perkiraan sisa ± *${Math.ceil((remainCount * SEND_DELAY) / 1000)} detik*`);
        }
        await delay(SEND_DELAY); // Jeda 5 detik per nomor (anti spam)
    }

    if (m.react) await m.react('✅');

    let reportTxt = `📊 *LAPORAN PENGIRIMAN PESAN*\n\n`;
    reportTxt += `• Total Input : *${cleaned.length} Nomor* (${uniqueNumbers.length} unik)\n`;
    reportTxt += `• Terdaftar WA : *${validTargets.length} Nomor*\n`;
    reportTxt += `• ✅ Berhasil Terkirim : *${success} Nomor*\n`;
    if (failed > 0) reportTxt += `• ❌ Gagal Terkirim : *${failed} Nomor*\n`;
    if (duplicates.length > 0) reportTxt += `• 🔁 Duplikat Digabung : *${duplicates.length} Nomor*\n`;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    reportTxt += `• ⏱️ Durasi Proses : *${elapsed} detik* (jeda ${SEND_DELAY / 1000} detik/nomor)\n`;

    if (duplicates.length > 0) {
        reportTxt += `\n🔁 *Nomor Duplikat (digabung jadi 1):*\n`;
        duplicates.forEach((d, idx) => {
            reportTxt += `${idx + 1}. +${d.num} (muncul ${d.count}x)\n`;
        });
    }

    if (notRegistered.length > 0) {
        reportTxt += `\n⚠️ *Tidak Terdaftar di WhatsApp (${notRegistered.length}):*\n`;
        notRegistered.forEach((no, idx) => {
            reportTxt += `${idx + 1}. +${no}\n`;
        });
    }

    await reply(reportTxt.trim());
};

handler.command = ['pinjol', 'multisend', 'kirimpesan', 'sendto'];
handler.help = ['multisend <nomor> <teks>'];
handler.tags = ['owner'];
handler.desc = 'Mengirim pesan/reply media ke daftar nomor (maks 20 nomor) dengan validasi akun WhatsApp';
handler.owner = true;
export default handler;
