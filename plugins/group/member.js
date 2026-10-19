import {
    resolveGroupAccess,
    findParticipantByJid,
    resolveTarget,
    numFromJid,
    invalidateGroupCache
} from '../../lib/group_utils.js';

const handler = async (m, { client, args, command, reply }) => {
    if (!m.isGroup) {
        return reply('👥 Perintah ini hanya bisa dipakai di dalam grup!');
    }

    const access = await resolveGroupAccess(client, m);
    if (!access.isAdmin && !m.isOwner) {
        return reply('⛔ Hanya Admin grup atau Owner yang bisa memakai perintah ini!');
    }
    if (!access.isBotAdmin && !m.isOwner) {
        return reply('⚠️ Jadikan bot sebagai *Admin grup* dulu supaya bisa mengelola anggota.');
    }

    const cmd = (command || '').toLowerCase();
    const targetJid = resolveTarget(m, args[0]);
    const targetPart = targetJid ? findParticipantByJid(access.meta, targetJid) : null;
    const targetAddr = targetPart?.jid || targetPart?.id || targetJid;
    const targetNum = targetJid ? numFromJid(targetJid) : '';

    try {
        switch (cmd) {
            case 'add':
            case 'tambah': {
                const target = targetJid || (args[0] ? resolveTarget(m, args[0]) : '');
                const n = target ? numFromJid(target) : '';
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

                if (statusCode === 200 || res?.status === 'ok') {
                    invalidateGroupCache(m.chat);
                    return reply(`✅ *+${n}* berhasil ditambahkan ke grup.`);
                }

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

                if (statusCode === 408) {
                    return reply(`⚠️ *+${n}* baru saja keluar dari grup ini sehingga tidak dapat langsung dimasukkan kembali. Silakan undang melalui link grup.`);
                }

                if (statusCode === 409) {
                    return reply(`ℹ️ *+${n}* sudah berada di dalam grup ini.`);
                }

                if (statusCode === 401) {
                    return reply(`❌ Gagal menambahkan *+${n}*: Nomor tersebut memblokir bot atau akun bot tidak diizinkan menambahkan.`);
                }

                if (statusCode === 400) {
                    return reply(`❌ Gagal menambahkan *+${n}*: Nomor tidak valid atau belum terdaftar di WhatsApp.`);
                }

                return reply(`❌ Gagal menambahkan *+${n}* (Status server WhatsApp: ${statusCode}).`);
            }

            case 'kick':
            case 'tendang': {
                if (!targetAddr) return reply('⚠️ Tag/reply anggota yang mau dikeluarkan.\nContoh: *.kick @user*');
                if (targetPart && (targetPart.isAdmin || targetPart.isSuperAdmin)) {
                    return reply('⛔ Tidak bisa mengeluarkan sesama Admin grup.');
                }
                const res = await client.group.removeParticipants(m.chat, [targetAddr]);
                const result = Array.isArray(res) && res.length > 0 ? res[0] : null;
                if (result && result.status !== 'ok' && result.code !== 200) {
                    return reply(`❌ Gagal mengeluarkan *+${targetNum}* (Status WhatsApp: ${result.code || result.status}).`);
                }
                invalidateGroupCache(m.chat);
                return reply(`✅ *+${targetNum}* telah dikeluarkan dari grup.`);
            }

            case 'promote':
            case 'naik': {
                if (!targetAddr) return reply('⚠️ Tag/reply anggota yang mau dinaikkan jadi Admin.');
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
        }
    } catch (e) {
        console.error('[Group Member Error]', e);
        return reply(`❌ Gagal: ${e.message || e}`);
    }
};

handler.help = ['add <nomor>', 'kick @user', 'promote @user', 'demote @user'];
handler.tags = ['group'];
handler.command = ['add', 'tambah', 'kick', 'tendang', 'promote', 'naik', 'demote', 'turun'];
handler.desc = 'Manajemen anggota grup (tambah, keluarkan, angkat/turunkan admin)';
handler.group = true;
handler.admin = true;

export default handler;
