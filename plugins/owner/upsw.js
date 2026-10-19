const handler = async (m, { client, text, command, reply }) => {
    try {
        const targetMsg = m.quoted ? m.quoted : m;
        const mtype = targetMsg.mtype || '';
        const isImage = mtype === 'imageMessage' || targetMsg.msg?.mimetype?.startsWith('image/');
        const isVideo = mtype === 'videoMessage' || targetMsg.msg?.mimetype?.startsWith('video/');
        const isAudio = mtype === 'audioMessage' || targetMsg.msg?.mimetype?.startsWith('audio/');

        // Ambil daftar penerima status dari database pengguna
        // Status WhatsApp dikirim ke kontak yang ada di memori/database
        const registeredUsers = Object.keys(global.db?.data?.users || {})
            .filter(jid => jid.endsWith('@s.whatsapp.net') && !jid.includes(':'));

        // Jika DB kosong, minimal tambahkan pengirim/owner
        const recipients = registeredUsers.length > 0 ? registeredUsers : [m.sender];

        let contentToSend;

        if (isImage || isVideo || isAudio) {
            await reply('⏳ Mengunduh media dan mengunggah status WhatsApp...');
            let mediaBuf;
            try {
                mediaBuf = await targetMsg.download();
            } catch (e) {
                return reply(`❌ Gagal mengunduh media: ${e.message}`);
            }

            if (!mediaBuf || !mediaBuf.length) {
                return reply('❌ Buffer media kosong.');
            }

            const caption = text ? text.trim() : (targetMsg.text || '');

            if (isImage) {
                contentToSend = {
                    image: mediaBuf,
                    caption: caption || undefined,
                    mimetype: targetMsg.msg?.mimetype || 'image/jpeg'
                };
            } else if (isVideo) {
                contentToSend = {
                    video: mediaBuf,
                    caption: caption || undefined,
                    mimetype: targetMsg.msg?.mimetype || 'video/mp4'
                };
            } else if (isAudio) {
                contentToSend = {
                    audio: mediaBuf,
                    mimetype: targetMsg.msg?.mimetype || 'audio/mp4',
                    ptt: true
                };
            }
        } else {
            // Text status
            const statusText = (text || m.quoted?.text || '').trim();
            if (!statusText) {
                return reply(
                    `📢 *CARA UPLOAD STATUS WHATSAPP*\n\n` +
                    `• *.upsw <teks>* — Buat status teks\n` +
                    `• *.upsw* (Reply foto/video/VN) — Upload status media\n\n` +
                    `_Contoh: *.upsw Halo semua, ini status dari bot!*_`
                );
            }

            contentToSend = {
                text: statusText
            };
        }

        const res = await client.status.send({
            content: contentToSend,
            recipients
        });

        const msgId = res?.messageId || res?.key?.id || '';
        return reply(`✅ *Status WhatsApp berhasil dipublikasikan!*${msgId ? `\n• Status ID: ${msgId}` : ''}\n• Terkirim ke: *${recipients.length}* penerima`);
    } catch (err) {
        console.error('[Upload Status Error]', err);
        return reply(`❌ Gagal mengunggah status: ${err.message || err}`);
    }
};

handler.help = ['upsw [teks/reply media]'];
handler.tags = ['owner'];
handler.command = ['upsw', 'statuswa', 'setstory', 'upstory'];
handler.desc = 'Unggah teks atau media langsung ke Status/Story WhatsApp (Owner)';
handler.owner = true;

export default handler;
