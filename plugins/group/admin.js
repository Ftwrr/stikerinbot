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
                const res = await client.group.removeParticipants(m.chat, [targetAddr]);
                const result = Array.isArray(res) && res.length > 0 ? res[0] : null;
                if (result && result.status !== 'ok' && result.code !== 200) {
                    return reply(`❌ Gagal mengeluarkan *+${targetNum}* (Status WhatsApp: ${result.code || result.status}).`);
                }
                invalidateGroupCache(m.chat);
                return reply(`✅ *+${targetNum}* telah dikeluarkan dari grup.`);
            }

            case 'add':
            case 'tambah': {
                const target = targetJid || (args[0] ? resolveTarget(m, args[0]) : '');
                const n = target ? getNumber(target) : '';
                if (!target || !n || n.length < 8) {
                    return reply('⚠️ Masukkan nomor yang valid atau tag/reply pengguna yang ingin ditambahkan.\nContoh: *.add 085123456789* atau *.add 6285123456789*');
                }

                if (findParticipantByJid(access.meta, target)) {
                    return reply(`ℹ️ *+${n}* sudah berada di dalam grup ini.`);
                }

                let results;
                try {
                    results = await client.group.addParticipants(m.chat, [target]);
                } catch (addErr) {
                    return reply(`❌ Gagal menambahkan *+${n}*: ${addErr.message || addErr}`);
                }

                const res = Array.isArray(results) && results.length > 0 ? results[0] : null;
                const statusCode = res ? Number(res.code || (res.status === 'ok' ? 200 : 400)) : 200;

                // 1. Sukses langsung bergabung (Code 200 / Status OK)
                if (statusCode === 200 || res?.status === 'ok') {
                    invalidateGroupCache(m.chat);
                    return reply(`✅ *+${n}* berhasil ditambahkan ke grup.`);
                }

                // 2. Privasi WhatsApp target membatasi ditambahkan langsung (Code 403)
                if (statusCode === 403) {
                    let inviteLink = '';
                    try {
                        const code = await client.group.queryInviteCode(m.chat);
                        const codeStr = typeof code === 'string' ? code : (code?.code || '');
                        if (codeStr) inviteLink = `https://chat.whatsapp.com/${codeStr}`;
                    } catch (_) {}

                    const groupName = access.meta?.subject || 'Grup WhatsApp';
                    let sentPrivate = false;

                    if (inviteLink) {
                        try {
                            await client.sendMessage(target, {
                                text: `👋 Halo!\nAnda diundang oleh Admin untuk bergabung ke grup *${groupName}*:\n🔗 ${inviteLink}`
                            });
                            sentPrivate = true;
                        } catch (_) {}
                    }

                    if (sentPrivate) {
                        return reply(
                            `⚠️ Tidak dapat menambahkan *+${n}* secara langsung karena setelan privasi WhatsApp akun tersebut.\n\n` +
                            `📩 *Link undangan grup telah otomatis dikirimkan ke chat pribadi mereka.*`
                        );
                    } else if (inviteLink) {
                        return reply(
                            `⚠️ Tidak dapat menambahkan *+${n}* secara langsung karena setelan privasi akun tersebut.\n\n` +
                            `🔗 Silakan bagikan link undangan grup ini ke mereka:\n${inviteLink}`
                        );
                    } else {
                        return reply(
                            `⚠️ Tidak dapat menambahkan *+${n}* secara langsung karena setelan privasi akun WhatsApp mereka (Undangan hanya dapat melalui link grup).`
                        );
                    }
                }

                // 3. Target baru saja keluar dari grup ini (Code 408)
                if (statusCode === 408) {
                    return reply(`⚠️ *+${n}* baru saja keluar dari grup ini sehingga tidak dapat langsung dimasukkan kembali. Silakan undang melalui link grup.`);
                }

                // 4. Target sudah ada di dalam grup (Code 409)
                if (statusCode === 409) {
                    return reply(`ℹ️ *+${n}* sudah berada di dalam grup ini.`);
                }

                // 5. Bot diblokir target atau tidak memiliki otorisasi (Code 401)
                if (statusCode === 401) {
                    return reply(`❌ Gagal menambahkan *+${n}*: Nomor tersebut memblokir bot atau akun bot tidak diizinkan menambahkan.`);
                }

                // 6. Nomor tidak valid / belum terdaftar di WhatsApp (Code 400)
                if (statusCode === 400) {
                    return reply(`❌ Gagal menambahkan *+${n}*: Nomor tidak valid atau belum terdaftar di WhatsApp.`);
                }

                // 7. Respon error lainnya
                return reply(`❌ Gagal menambahkan *+${n}* (Status server WhatsApp: ${statusCode}).`);
            }

            case 'promote':
            case 'naik': {
                if (!targetAddr) return reply('⚠️ Tag/reply anggota yang mau dijadikan Admin.');
                if (targetPart && (targetPart.isAdmin || targetPart.isSuperAdmin)) {
                    return reply('ℹ️ Dia sudah menjadi Admin grup.');
                }
                const res = await client.group.promoteParticipants(m.chat, [targetAddr]);
                const result = Array.isArray(res) && res.length > 0 ? res[0] : null;
                if (result && result.status !== 'ok' && result.code !== 200) {
                    return reply(`❌ Gagal menaikkan *+${targetNum}* (Status WhatsApp: ${result.code || result.status}).`);
                }
                invalidateGroupCache(m.chat);
                return reply(`👑 *+${targetNum}* sekarang menjadi Admin grup.`);
            }

            case 'demote':
            case 'turun': {
                if (!targetAddr) return reply('⚠️ Tag/reply admin yang mau diturunkan.');
                if (targetPart && !(targetPart.isAdmin || targetPart.isSuperAdmin)) {
                    return reply('ℹ️ Dia bukan Admin grup.');
                }
                const res = await client.group.demoteParticipants(m.chat, [targetAddr]);
                const result = Array.isArray(res) && res.length > 0 ? res[0] : null;
                if (result && result.status !== 'ok' && result.code !== 200) {
                    return reply(`❌ Gagal menurunkan *+${targetNum}* (Status WhatsApp: ${result.code || result.status}).`);
                }
                invalidateGroupCache(m.chat);
                return reply(`⬇️ *+${targetNum}* tidak lagi menjadi Admin grup.`);
            }

            case 'close':
            case 'tutup': {
                await client.group.setSetting(m.chat, 'announcement', true);
                invalidateGroupCache(m.chat);
                return reply('🔒 *Grup Ditutup!*\nSekarang hanya Admin grup yang dapat mengirim pesan.');
            }

            case 'open':
            case 'buka': {
                await client.group.setSetting(m.chat, 'announcement', false);
                invalidateGroupCache(m.chat);
                return reply('🔓 *Grup Dibuka!*\nSekarang semua anggota grup dapat mengirim pesan.');
            }

            case 'lock':
            case 'kunci': {
                await client.group.setSetting(m.chat, 'restrict', true);
                invalidateGroupCache(m.chat);
                return reply('🔐 *Edit Info Grup Dikunci!*\nHanya Admin yang dapat mengubah nama, deskripsi, dan ikon grup.');
            }

            case 'unlock':
            case 'bukakunci': {
                await client.group.setSetting(m.chat, 'restrict', false);
                invalidateGroupCache(m.chat);
                return reply('🔓 *Edit Info Grup Dibuka!*\nSemua anggota dapat mengubah nama, deskripsi, dan ikon grup.');
            }

            case 'setname':
            case 'setsubject': {
                if (!text) return reply('⚠️ Masukkan nama grup baru.\nContoh: *.setname Grup Keren*');
                if (text.length > 100) return reply('⚠️ Nama grup terlalu panjang! Maksimal 100 karakter.');
                await client.group.setSubject(m.chat, text.trim());
                invalidateGroupCache(m.chat);
                return reply(`✅ Nama grup diubah menjadi *${text.trim()}*.`);
            }

            case 'setdesc':
            case 'setdesk': {
                if (!text) return reply('⚠️ Masukkan deskripsi grup baru.\nContoh: *.setdesc Grup diskusi santai*');
                if (text.length > 2048) return reply('⚠️ Deskripsi terlalu panjang! Maksimal 2048 karakter.');
                await client.group.setDescription(m.chat, text.trim());
                invalidateGroupCache(m.chat);
                return reply('✅ Deskripsi grup berhasil diubah.');
            }

            case 'revoke':
            case 'resetlink': {
                const code = await client.group.revokeInvite(m.chat);
                const codeStr = typeof code === 'string' ? code : (code?.code || '');
                return reply(`✅ Link undangan grup direset.\nLink baru:\nhttps://chat.whatsapp.com/${codeStr}`);
            }

            case 'ephemeral':
            case 'pesansementara': {
                const opt = (args[0] || '').toLowerCase();
                let sec = 0;
                let descStr = '';

                if (opt === '24h' || opt === '1d' || opt === '24jam') {
                    sec = 86400;
                    descStr = '24 Jam';
                } else if (opt === '7d' || opt === '7hari') {
                    sec = 604800;
                    descStr = '7 Hari';
                } else if (opt === '90d' || opt === '90hari') {
                    sec = 7776000;
                    descStr = '90 Hari';
                } else if (opt === 'off' || opt === 'mati' || opt === '0') {
                    sec = 0;
                    descStr = 'Mati (Off)';
                } else {
                    return reply(
                        `⏳ *PENGATURAN PESAN SEMENTARA*\n\n` +
                        `• *.ephemeral 24h* (24 Jam)\n` +
                        `• *.ephemeral 7d* (7 Hari)\n` +
                        `• *.ephemeral 90d* (90 Hari)\n` +
                        `• *.ephemeral off* (Matikan pesan sementara)`
                    );
                }

                await client.group.setEphemeralDuration(m.chat, sec);
                invalidateGroupCache(m.chat);
                return reply(`✅ Pesan sementara diatur ke: *${descStr}*`);
            }

            case 'leave':
            case 'keluar': {
                await reply('👋 *Selamat tinggal semuanya!* Bot keluar dari grup.');
                await client.group.leaveGroup([m.chat]);
                return;
            }

            default:
                return reply(
                    `👥 *PANDUAN MANAJEMEN GRUP*\n\n` +
                    `• *.add <nomor>* — Tambah anggota\n` +
                    `• *.kick @user* — Keluarkan anggota\n` +
                    `• *.promote @user* — Jadikan admin\n` +
                    `• *.demote @user* — Turunkan admin\n` +
                    `• *.close / .open* — Tutup / buka chat grup\n` +
                    `• *.lock / .unlock* — Kunci / buka edit info grup\n` +
                    `• *.setname <teks>* — Ubah nama grup\n` +
                    `• *.setdesc <teks>* — Ubah deskripsi grup\n` +
                    `• *.ephemeral <waktu>* — Atur pesan sementara\n` +
                    `• *.revoke* — Reset link undangan\n` +
                    `• *.leave* — Perintahkan bot keluar grup\n` +
                    `• *.groupinfo* — Info detail grup`
                );
        }
    } catch (e) {
        console.error('[Group Admin Error]', e);
        return reply(`❌ Gagal: ${e.message || e}`);
    }
};

handler.command = [
    'kick', 'tendang',
    'add', 'tambah',
    'promote', 'naik',
    'demote', 'turun',
    'close', 'tutup',
    'open', 'buka',
    'lock', 'kunci',
    'unlock', 'bukakunci',
    'setname', 'setsubject',
    'setdesc', 'setdesk',
    'revoke', 'resetlink',
    'ephemeral', 'pesansementara',
    'leave', 'keluar',
    'groupinfo', 'infogc', 'gcinfo'
];
handler.category = 'Group';
handler.desc = 'Manajemen grup (add, kick, promote, demote, close/open, lock/unlock, setname, setdesc, revoke, ephemeral, leave, groupinfo)';
handler.group = true;
handler.limit = false;
export default handler;
