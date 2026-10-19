const handler = async (m, { client, from, text, args, command, isOwner, reply }) => {
    if (!isOwner) return reply('⛔ Perintah ini khusus untuk Owner bot!');

    const cmd = command.toLowerCase();
    const subAction = (args[0] || '').toLowerCase();

    if (!global.db.data.settings) global.db.data.settings = {};
    if (!Array.isArray(global.db.data.settings.bcgBlacklist)) {
        global.db.data.settings.bcgBlacklist = [];
    }

    const blList = global.db.data.settings.bcgBlacklist;

    // ─── LIST BLACKLIST BCG (.listblbcg / .blbcg list) ────────────────────────
    if (cmd === 'listblbcg' || subAction === 'list') {
        if (blList.length === 0) {
            return reply('ℹ️ Belum ada grup yang masuk blacklist broadcast.');
        }

        let txt = `🚫 *DAFTAR BLACKLIST BROADCAST GROUP* (${blList.length})\n\n`;
        blList.forEach((jid, i) => {
            const chatObj = global.db.data.chats?.[jid];
            const name = chatObj?.subject || chatObj?.name || jid;
            txt += `${i + 1}. *${name}*\n   ➥ JID: \`${jid}\`\n\n`;
        });
        txt += `_Grup di atas tidak akan menerima pesan .bcg._`;
        return reply(txt.trim());
    }

    // ─── DEL / HAPUS DARI BLACKLIST (.delblbcg / .blbcg del) ──────────────────
    if (cmd === 'delblbcg' || ['del', 'delete', 'remove', 'hapus'].includes(subAction)) {
        let targetJid = (subAction && !['del', 'delete', 'remove', 'hapus'].includes(subAction) ? subAction : args[1]) || (m.isGroup ? from : '');

        if (!targetJid) {
            return reply('⚠️ Masukkan JID grup yang ingin dihapus dari blacklist!\nContoh: *.delblbcg 120363407161627482@g.us*');
        }

        const idx = blList.indexOf(targetJid);
        if (idx === -1) {
            return reply(`⚠️ Grup \`${targetJid}\` tidak ada dalam daftar blacklist BCG.`);
        }

        blList.splice(idx, 1);
        global.db.scheduleSave();
        return reply(`✅ *BERHASIL DIHAPUS DARI BLACKLIST*\n\nGrup \`${targetJid}\` sekarang akan menerima pesan .bcg kembali.`);
    }

    // ─── ADD / TAMBAH KE BLACKLIST (.addblbcg) ────────────────────────────────
    let targetJid = text.trim();
    if (!targetJid && m.isGroup) {
        targetJid = from;
    }

    if (!targetJid || !targetJid.endsWith('@g.us')) {
        return reply(`⚠️ Masukkan JID grup yang valid atau jalankan perintah ini di dalam grup yang ingin di-blacklist!\n\n*Contoh:*\n• *.addblbcg* (Jalankan di grup target)\n• *.addblbcg 120363407161627482@g.us*`);
    }

    if (blList.includes(targetJid)) {
        return reply(`⚠️ Grup \`${targetJid}\` sudah ada dalam daftar blacklist BCG.`);
    }

    blList.push(targetJid);
    global.db.scheduleSave();

    const groupName = global.db.data.chats?.[targetJid]?.subject || targetJid;
    await reply(`🚫 *GRUP DITAMBAHKAN KE BLACKLIST BCG*\n\n• Target : *${groupName}*\n• JID : \`${targetJid}\`\n\n_Grup ini dilewati saat Owner menjalankan broadcast .bcg._`);
};

handler.command = ['addblbcg', 'delblbcg', 'listblbcg', 'blbcg'];
handler.help = ['blbcg'];
handler.tags = ['owner'];
handler.desc = 'Kelola daftar grup yang dikecualikan (blacklist) dari broadcast group';
handler.owner = true;
export default handler;
