import { resolveGroupAccess, numFromJid, invalidateGroupCache } from '../../lib/group_utils.js';

const handler = async (m, { client, text, args, command, reply }) => {
    if (!m.isGroup) {
        return reply('👥 Perintah ini hanya bisa dipakai di dalam grup!');
    }

    const cmd = (command || '').toLowerCase();

    // ── groupinfo bisa diakses semua anggota ─────────────────────────────────
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
            `• *Owner* : ${meta.owner ? '+' + numFromJid(meta.owner) : '-'}\n` +
            `• *Restrict* : ${meta.announce ? 'Hanya Admin' : 'Semua Anggota'}\n` +
            `• *Deskripsi* :\n${meta.desc ? String(meta.desc).slice(0, 500) : '(kosong)'}`;
        return reply(info);
    }

    // ── Selebihnya wajib Admin grup / Owner ─────────────────────────────────
    const access = await resolveGroupAccess(client, m);
    if (!access.isAdmin && !m.isOwner) {
        return reply('⛔ Hanya Admin grup atau Owner yang bisa mengubah info grup!');
    }
    if (!access.isBotAdmin && !m.isOwner) {
        return reply('⚠️ Jadikan bot sebagai *Admin grup* dulu untuk mengubah info grup.');
    }

    try {
        switch (cmd) {
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
                        `• *.ephemeral off* (Matikan)`
                    );
                }

                await client.group.setEphemeralDuration(m.chat, sec);
                invalidateGroupCache(m.chat);
                return reply(`✅ Pesan sementara diatur ke: *${descStr}*`);
            }
        }
    } catch (e) {
        console.error('[Group Info Error]', e);
        return reply(`❌ Gagal: ${e.message || e}`);
    }
};

handler.help = ['groupinfo', 'setname <teks>', 'setdesc <teks>', 'revoke', 'ephemeral <durasi>'];
handler.tags = ['group'];
handler.command = [
    'groupinfo', 'infogc', 'gcinfo',
    'setname', 'setsubject',
    'setdesc', 'setdesk',
    'revoke', 'resetlink',
    'ephemeral', 'pesansementara'
];
handler.desc = 'Informasi grup dan pengaturan nama, deskripsi, link invite, pesan sementara';
handler.group = true;

export default handler;
