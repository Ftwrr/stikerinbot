import { resolvePhoneNumberFromLid } from '../../lib/lid_helper.js';

const MORE_CHAR = String.fromCharCode(8206);
const READ_MORE = MORE_CHAR.repeat(4001);

const getNumberFromJid = (jid) => String(jid).replace(/@.+/, '').split(':')[0].replace(/[^0-9]/g, '');

const handler = async (m, { client, from, text, command, reply, isOwner }) => {
    if (!m.isGroup) {
        return reply('❌ Perintah ini hanya dapat digunakan di dalam grup!');
    }

    const cmd = (command || '').toLowerCase();

    // 1. Ambil metadata grup & daftar anggota
    let participants = [];
    try {
        const groupMeta = await client.group.queryGroupMetadata(m.chat);
        participants = groupMeta.participants || [];
    } catch (e) {
        console.error('[Hidetag Error fetching group meta]', e.message);
    }

    if (!participants.length) {
        return reply('❌ Gagal mengambil daftar anggota grup.');
    }

    // 2. Cek permission Admin — mendukung Zapo (isAdmin/isSuperAdmin boolean) + LID addressing
    const senderPn = m.realPhone || m.senderNumber || getNumberFromJid(m.sender);
    const senderLidNum = m.sender.includes('@lid') ? getNumberFromJid(m.sender) : '';

    const participantObj = participants.find(p => {
        const pJid = p.jid || p.id || '';
        const pLid = p.lid || '';
        const pNum = getNumberFromJid(pJid);
        const pLidNum = pLid ? getNumberFromJid(pLid) : '';
        const pPhone = p.phoneNumber ? p.phoneNumber.replace(/[^0-9]/g, '') : '';

        return (
            (senderPn && (pNum === senderPn || pPhone === senderPn || pLidNum === senderPn)) ||
            (senderLidNum && (pLidNum === senderLidNum || pNum === senderLidNum)) ||
            pJid === m.sender
        );
    });

    const isGroupAdmin = Boolean(
        participantObj?.isAdmin ||
        participantObj?.isSuperAdmin ||
        participantObj?.admin === 'admin' ||
        participantObj?.admin === 'superadmin'
    );

    if (!isGroupAdmin && !isOwner && !m.isOwner) {
        return reply('⛔ Hanya Admin grup atau Owner yang dapat menggunakan perintah ini!');
    }

    // 3. Susun daftar mention JID
    const botNum = client.user?.id ? getNumberFromJid(client.user.id) : '';

    const mentionedJids = participants
        .map(p => p.jid || p.id || '')
        .filter(jid => {
            if (!jid) return false;
            const num = getNumberFromJid(jid);
            return num && num !== botNum;
        });

    if (!mentionedJids.length) {
        return reply('❌ Tidak ada anggota grup yang dapat di-tag.');
    }

    // 4. Susun pesan respon
    let responseText = '';
    let targetMedia = null;

    if (cmd === 'tagall') {
        const header = text ? `*✧ T A G A L L ✧*\n\n${text}\n${READ_MORE}\n` : `*✧ T A G A L L ✧*\n${READ_MORE}\n`;
        const list = mentionedJids.map(jid => `• @${getNumberFromJid(jid)}`).join('\n');
        responseText = header + list;
    } else if (cmd === 'everyone') {
        const prompt = text || 'Pemberitahuan penting!';
        responseText = `📢 *@everyone*\n\n${prompt}`;
    } else {
        const q = m.quoted || m;
        responseText = text || q.text || '';

        if (q.mtype === 'imageMessage') targetMedia = { type: 'image', mimetype: 'image/jpeg' };
        else if (q.mtype === 'videoMessage') targetMedia = { type: 'video', mimetype: 'video/mp4' };
        else if (q.mtype === 'stickerMessage') targetMedia = { type: 'sticker' };
        else if (q.mtype === 'audioMessage') targetMedia = { type: 'audio', mimetype: 'audio/mp4', ptt: q.msg?.ptt || false };
        else if (q.mtype === 'documentMessage') targetMedia = { type: 'document', mimetype: 'application/octet-stream', fileName: q.msg?.fileName || 'document' };

        if (!responseText && !targetMedia) {
            return reply(`⚠️ Teks atau media mana yang ingin di-hidetag?\nContoh: *.${cmd} Pengumuman rapat* atau reply media dengan *.${cmd}*`);
        }
    }

    // 5. Kirim Pesan dengan Mentions
    try {
        if (targetMedia) {
            const q = m.quoted || m;
            const buf = await q.download();
            const payload = {
                type: targetMedia.type,
                media: buf,
                caption: responseText,
                contextInfo: { mentionedJid: mentionedJids }
            };
            if (targetMedia.mimetype) payload.mimetype = targetMedia.mimetype;
            if (targetMedia.fileName) payload.fileName = targetMedia.fileName;
            if (targetMedia.ptt !== undefined) payload.ptt = targetMedia.ptt;

            await client.message.send(m.chat, payload, { mentions: mentionedJids });
        } else {
            await client.message.send(m.chat, {
                type: 'text',
                text: responseText,
                contextInfo: { mentionedJid: mentionedJids }
            }, {
                mentions: mentionedJids
            });
        }
    } catch (err) {
        console.error('[Hidetag Send Error]', err);
        await reply(`❌ Gagal mengirim hidetag: ${err.message}`);
    }
};

handler.command = ['hidetag', 'tagall', 'totag', 'everyone', 'pengumuman', 'announce'];
handler.help = ['hidetag <teks>'];
handler.tags = ['group'];
handler.desc = 'Tag semua member grup (Admin only)';
export default handler;
