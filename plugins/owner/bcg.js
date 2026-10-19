const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const handler = async (m, { client, text, isOwner, reply }) => {
    if (!isOwner) return reply('⛔ Perintah ini khusus untuk Owner bot!');

    const bcText = text.trim();
    if (!bcText && !m.quoted) {
        return reply(`📢 *BROADCAST GROUP (BCG)*

Format: *.bcg <pesan>* atau reply pesan/media dengan *.bcg*

_Contoh: *.bcg Halo semua, bot sedang maintenance fitur baru!*_`);
    }

    if (m.react) await m.react('⏳');

    // Ambil daftar grup yang diikuti bot
    let groupList = [];

    // 1. Ambil dari Zapo Group Coordinator
    try {
        if (client.group?.queryAllGroups) {
            const allGroups = await client.group.queryAllGroups();
            if (Array.isArray(allGroups)) {
                groupList = allGroups.map(g => g.jid || g.id).filter(Boolean);
            }
        }
    } catch (e) {
        console.error('[BCG queryAllGroups error]', e.message);
    }

    // 2. Fallback: Ambil dari global.db.data.chats
    if (groupList.length === 0 && global.db?.data?.chats) {
        groupList = Object.keys(global.db.data.chats).filter(jid => jid.endsWith('@g.us'));
    }

    // Filter grup yang ada di blacklist BCG
    const bcgBlacklist = Array.isArray(global.db?.data?.settings?.bcgBlacklist) ? global.db.data.settings.bcgBlacklist : [];
    groupList = groupList.filter(jid => !bcgBlacklist.includes(jid));

    if (groupList.length === 0) {
        if (m.react) await m.react('❌');
        return reply('❌ Tidak ada grup target (seluruh grup masuk daftar blacklist atau bot belum join grup).');
    }

    const header = `📢 *BROADCAST PENGUMUMAN*\n\n`;
    let success = 0;
    let failed = 0;

    // Handle jika reply media (gambar/stiker/video/dokumen)
    const q = m.quoted || null;

    for (const groupJid of groupList) {
        try {
            if (q && (q.mtype === 'imageMessage' || q.msg?.imageMessage)) {
                const imgBuf = await q.download();
                await client.sendMessage(groupJid, {
                    image: imgBuf,
                    caption: header + (bcText || q.text || '')
                });
            } else if (q && (q.mtype === 'videoMessage' || q.msg?.videoMessage)) {
                const vidBuf = await q.download();
                await client.sendMessage(groupJid, {
                    video: vidBuf,
                    caption: header + (bcText || q.text || '')
                });
            } else if (q && (q.mtype === 'stickerMessage' || q.msg?.stickerMessage)) {
                const stkBuf = await q.download();
                await client.sendMessage(groupJid, { sticker: stkBuf });
                if (bcText) {
                    await client.sendMessage(groupJid, { text: header + bcText });
                }
            } else {
                await client.sendMessage(groupJid, { text: header + (bcText || q?.text || '') });
            }

            success++;
            await delay(5000); // Jeda 5 detik antar grup untuk mencegah banned/rate limit
        } catch (err) {
            console.error(`[BCG Error Group: ${groupJid}]`, err.message);
            failed++;
        }
    }

    if (m.react) await m.react('✅');

    const resultTxt = `✅ *BROADCAST GROUP SELESAI*

• Total Target : *${groupList.length} Grup*
• Berhasil Terkirim : *${success} Grup*
• Gagal : *${failed} Grup*`;

    await reply(resultTxt);
};

handler.command = ['bcg', 'broadcastgroup', 'bcgroup', 'bcgc'];
handler.help = ['bcg <teks>'];
handler.tags = ['owner'];
handler.desc = 'Mengirimkan pesan siaran / broadcast ke seluruh grup yang diikuti bot';
handler.owner = true;
export default handler;
