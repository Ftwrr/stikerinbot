import {
    resolveGroupAccess,
    findParticipantByJid,
    resolveTarget,
    numFromJid,
    invalidateGroupCache
} from '../../lib/group_utils.js';

const getNumber = numFromJid;

const handler = async (m, { client, text, args, command, reply }) => {
    if (!m.isGroup) {
        return reply('👥 Perintah admin grup hanya bisa dipakai di dalam grup!');
    }

    const cmd = (command || '').toLowerCase();

    // ── GROUP INFO tidak butuh admin ────────────────────────────────────────
    if (cmd === 'groupinfo' || cmd === 'infogc' || cmd === 'gcinfo') {
        let access;
        try {
            access = await resolveGroupAccess(client, m);
        } catch (e) {
            return reply(`❌ Gagal mengambil info grup: ${e.message}`);
        }
        const { meta } = access;
        const admins = (meta.participants || []).filter(p => p.isAdmin || p.isSuperAdmin || p.admin === 'admin' || p.admin === 'superadmin');
        const info =
            `📊 *INFO GRUP*\n\n` +
            `• *Nama* : ${meta.subject || '-'}\n` +
            `• *ID* : ${m.chat}\n` +
            `• *Anggota* : ${(meta.participants || []).length}\n` +
            `• *Admin* : ${admins.length}\n` +
            `• *Owner* : ${meta.owner ? '+' + getNumber(meta.owner) : '-'}\n` +
            `• *Restrict* : ${meta.announce ? 'Ya' : 'Tidak'}\n` +
            `• *Deskripsi* :\n${meta.desc ? String(meta.desc).slice(0, 400) : '(kosong)'}`;
        return reply(info);
    }

    // ── Selebihnya wajib Admin grup / Owner ────────────────────────────────
    let access;
    try {
        access = await resolveGroupAccess(client, m);
    } catch (e) {
        return reply(`❌ Gagal mengambil data grup: ${e.message}`);
    }

    if (!access.isAdmin && !m.isOwner) {
        return reply('⛔ Hanya Admin grup atau Owner yang bisa memakai perintah ini!');
    }
    if (!access.isBotAdmin && !m.isOwner) {
        return reply('⚠️ Jadikan bot sebagai *Admin grup* dulu supaya bisa mengelola anggota.');
    }

    const targetJid = resolveTarget(m, args[0]);
    const targetPart = targetJid ? findParticipantByJid(access.meta, targetJid) : null;
    const targetAddr = targetPart?.jid || targetPart?.id || targetJid;
    const targetNum = targetJid ? getNumber(targetJid) : '';

    try {
        switch (cmd) {
            case 'kick':
            case 'tendang': {
                if (!targetAddr) return reply('⚠️ Tag/reply anggota yang mau ditendang.\nContoh: *.kick @user*');
                if (targetPart && (targetPart.isAdmin || targetPart.isSuperAdmin)) {
                    return reply('⛔ Tidak bisa menendang sesama Admin grup.');
                }
                await client.group.removeParticipants(m.chat, [targetAddr]);
                invalidateGroupCache(m.chat);
                return reply(`✅ *+${targetNum}* telah dikeluarkan dari grup.`);
            }

            case 'add':
            case 'tambah': {
                const clean = String(args[0] || '').replace(/[^0-9]/g, '');
                if (clean.length < 8) return reply('⚠️ Masukkan nomor yang valid.\nContoh: *.add 628123456789*');
                const n = clean.startsWith('0') ? `62${clean.slice(1)}` : clean;
                const jid = `${n}@s.whatsapp.net`;
                if (findParticipantByJid(access.meta, jid)) {
                    return reply(`ℹ️ *+${n}* sudah ada di grup ini.`);
                }
                await client.group.addParticipants(m.chat, [jid]);
                invalidateGroupCache(m.chat);
                return reply(`✅ *+${n}* telah ditambahkan ke grup.`);
            }

            case 'promote':
            case 'naik': {
                if (!targetAddr) return reply('⚠️ Tag/reply anggota yang mau dijadikan Admin.');
                if (targetPart && (targetPart.isAdmin || targetPart.isSuperAdmin)) {
                    return reply('ℹ️ Dia sudah menjadi Admin grup.');
                }
                await client.group.promoteParticipants(m.chat, [targetAddr]);
                invalidateGroupCache(m.chat);
                return reply(`👑 *+${targetNum}* sekarang menjadi Admin grup.`);
            }

            case 'demote':
            case 'turun': {
                if (!targetAddr) return reply('⚠️ Tag/reply admin yang mau diturunkan.');
                if (targetPart && !(targetPart.isAdmin || targetPart.isSuperAdmin)) {
                    return reply('ℹ️ Dia bukan Admin grup.');
                }
                await client.group.demoteParticipants(m.chat, [targetAddr]);
                invalidateGroupCache(m.chat);
                return reply(`⬇️ *+${targetNum}* tidak lagi menjadi Admin grup.`);
            }

            case 'setname':
            case 'setsubject': {
                if (!text) return reply('⚠️ Masukkan nama grup baru.\nContoh: *.setname Grup Keren*');
                await client.group.setSubject(m.chat, text.trim());
                invalidateGroupCache(m.chat);
                return reply(`✅ Nama grup diubah menjadi *${text.trim()}*.`);
            }

            case 'setdesc': {
                if (!text) return reply('⚠️ Masukkan deskripsi grup baru.\nContoh: *.setdesc Grup diskusi santai*');
                await client.group.setDescription(m.chat, text.trim());
                invalidateGroupCache(m.chat);
                return reply('✅ Deskripsi grup berhasil diubah.');
            }

            case 'revoke':
            case 'resetlink': {
                const code = await client.group.revokeInvite(m.chat);
                return reply(`✅ Link undangan grup direset.\nLink baru:\nhttps://chat.whatsapp.com/${code.code || code}`);
            }

            default:
                return reply(
                    `👥 *MANAJEMEN GRUP*\n\n` +
                    `• *.kick @user* — keluarkan anggota\n` +
                    `• *.add 62812...* — tambah anggota\n` +
                    `• *.promote @user* — jadikan admin\n` +
                    `• *.demote @user* — turunkan admin\n` +
                    `• *.setname <teks>* — ubah nama grup\n` +
                    `• *.setdesc <teks>* — ubah deskripsi\n` +
                    `• *.revoke* — reset link undangan\n` +
                    `• *.groupinfo* — info grup`
                );
        }
    } catch (e) {
        console.error('[Group Admin Error]', e);
        return reply(`❌ Gagal: ${e.message || e}`);
    }
};

handler.command = ['kick', 'tendang', 'add', 'tambah', 'promote', 'naik', 'demote', 'turun', 'setname', 'setsubject', 'setdesc', 'revoke', 'resetlink', 'groupinfo', 'infogc', 'gcinfo'];
handler.category = 'Group';
handler.desc = 'Manajemen grup (kick, add, promote, demote, setname, setdesc, revoke, groupinfo)';
handler.group = true;
handler.limit = false;
export default handler;
