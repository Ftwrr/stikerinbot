import { resolveGroupAccess, numFromJid, normalizePhone } from '../../lib/group_utils.js';

const handler = async (m, { client, args, command, reply, isOwner }) => {
    if (!m.isGroup) {
        return reply('👥 Fitur persetujuan anggota hanya berlaku di dalam grup!');
    }

    const access = await resolveGroupAccess(client, m);
    if (!access.isAdmin && !isOwner) {
        return reply('⛔ Hanya Admin grup yang dapat mengelola persetujuan anggota!');
    }
    if (!access.isBotAdmin) {
        return reply('⚠️ Bot harus menjadi Admin grup untuk menerima/menolak permintaan bergabung!');
    }

    const cmd = (command || '').toLowerCase();
    const sub = (args[0] || '').toLowerCase();

    try {
        // Ambil daftar antrean permintaan bergabung
        const requests = await client.group.queryMembershipApprovalRequests(m.chat);

        if (cmd === 'listreq' || cmd === 'listjoin' || cmd === 'reqlist') {
            if (!requests || requests.length === 0) {
                return reply('ℹ️ Tidak ada antrean permintaan bergabung yang tertunda di grup ini.');
            }

            let textOut = `📋 *DAFTAR PERMINTAAN BERGABUNG (${requests.length})*\n\n`;
            for (let i = 0; i < requests.length; i++) {
                const req = requests[i];
                const rawJid = req.jid || '';
                const phone = req.requestorPhone || numFromJid(rawJid);
                const reqTime = req.requestTime ? new Date(req.requestTime * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';

                textOut += `${i + 1}. *+${phone}*\n`;
                textOut += `   • Waktu Request: ${reqTime}\n`;
                textOut += `   • Ketik *.acc ${phone}* untuk menyetujui\n`;
                textOut += `   • Ketik *.reject ${phone}* untuk menolak\n\n`;
            }
            textOut += `_Ketik *.acc all* untuk menerima semua sekaligus._`;
            return reply(textOut.trim());
        }

        if (cmd === 'acc' || cmd === 'approve' || cmd === 'terima') {
            if (!requests || requests.length === 0) {
                return reply('ℹ️ Tidak ada antrean calon anggota yang perlu disetujui.');
            }

            if (!sub) {
                return reply(
                    `⚠️ Tentukan nomor target atau ketik *all*!\n\n` +
                    `*Contoh:*\n` +
                    `• *.acc 628123456789*\n` +
                    `• *.acc all* (Terima semua antrean)`
                );
            }

            if (sub === 'all' || sub === 'semua') {
                const targetJids = requests.map(r => r.jid).filter(Boolean);
                await client.group.approveMembershipRequests(m.chat, targetJids);
                return reply(`✅ *Berhasil menyetujui seluruh (${targetJids.length}) permintaan bergabung!*`);
            }

            // Normalisasi nomor target
            const targetPhone = normalizePhone(sub);
            const found = requests.find(r => {
                const p = r.requestorPhone || numFromJid(r.jid);
                return p === targetPhone || r.jid.startsWith(targetPhone);
            });

            if (!found) {
                return reply(`❌ Calon anggota dengan nomor *+${targetPhone}* tidak ditemukan dalam antrean persetujuan.`);
            }

            await client.group.approveMembershipRequests(m.chat, [found.jid]);
            return reply(`✅ Permintaan bergabung dari *+${targetPhone}* berhasil disetujui!`);
        }

        if (cmd === 'reject' || cmd === 'tolak') {
            if (!requests || requests.length === 0) {
                return reply('ℹ️ Tidak ada antrean calon anggota yang perlu ditolak.');
            }

            if (!sub) {
                return reply(
                    `⚠️ Tentukan nomor target atau ketik *all*!\n\n` +
                    `*Contoh:*\n` +
                    `• *.reject 628123456789*\n` +
                    `• *.reject all* (Tolak semua antrean)`
                );
            }

            if (sub === 'all' || sub === 'semua') {
                const targetJids = requests.map(r => r.jid).filter(Boolean);
                await client.group.rejectMembershipRequests(m.chat, targetJids);
                return reply(`🚫 *Berhasil menolak seluruh (${targetJids.length}) permintaan bergabung.*`);
            }

            const targetPhone = normalizePhone(sub);
            const found = requests.find(r => {
                const p = r.requestorPhone || numFromJid(r.jid);
                return p === targetPhone || r.jid.startsWith(targetPhone);
            });

            if (!found) {
                return reply(`❌ Calon anggota dengan nomor *+${targetPhone}* tidak ditemukan dalam antrean persetujuan.`);
            }

            await client.group.rejectMembershipRequests(m.chat, [found.jid]);
            return reply(`🚫 Permintaan bergabung dari *+${targetPhone}* telah ditolak.`);
        }
    } catch (err) {
        console.error('[Group Approval Error]', err);
        return reply(`❌ Gagal memproses persetujuan anggota: ${err.message || err}`);
    }
};

handler.help = ['listreq', 'acc <nomor/all>', 'reject <nomor/all>'];
handler.tags = ['group'];
handler.command = ['listreq', 'listjoin', 'reqlist', 'acc', 'approve', 'terima', 'reject', 'tolak'];
handler.desc = 'Kelola permintaan masuk grup WhatsApp (Persetujuan Admin)';
handler.group = true;
handler.admin = true;

export default handler;
