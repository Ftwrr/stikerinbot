import util from 'util';
import { unwrapMessage, getContentType } from 'zapo-js';
import { downloadMedia, restoreMediaBuffers, loadMessageById } from '../../simple.js';

export default async function handler(m, { client, from, reply }) {
    if (!m.quoted) {
        return reply('⚠️ Balas/reply pesan yang sedang me-reply pesan lain dengan *.q*');
    }

    try {
        const sendChat = from || m.chat;

        // 1. Ambil Message B (pesan yang di-reply oleh perintah .q)
        const msgB = loadMessageById(m.quoted.id) || m.quoted.message || m.quoted.msg;
        const bRaw = unwrapMessage(msgB) || msgB;
        const bType = getContentType(bRaw);
        const bContent = (bType && bRaw?.[bType]) ? bRaw[bType] : bRaw;

        // 2. Cari contextInfo di dalam Message B (yang mengarah ke Message A / pesan yang di-reply oleh B)
        const innerContext = bContent?.contextInfo ||
                             bRaw?.extendedTextMessage?.contextInfo ||
                             bRaw?.imageMessage?.contextInfo ||
                             bRaw?.videoMessage?.contextInfo ||
                             bRaw?.stickerMessage?.contextInfo ||
                             bRaw?.audioMessage?.contextInfo ||
                             bRaw?.documentMessage?.contextInfo ||
                             m.quoted.msg?.contextInfo;

        let targetToSend = null;

        // 3. Jika Message B meng-quote Message A, ambil Message A dari SQLite/Cache atau dari inner quotedMessage
        if (innerContext?.stanzaId) {
            const msgA = loadMessageById(innerContext.stanzaId);
            if (msgA) {
                targetToSend = msgA;
            }
        }

        if (!targetToSend && innerContext?.quotedMessage) {
            targetToSend = innerContext.quotedMessage;
        }

        // 4. Jika Message B tidak meng-quote apapun, beri tahu pengguna atau fallback ke Message B
        if (!targetToSend) {
            targetToSend = bRaw || m.quoted.msg || m.quoted.message;
        }

        targetToSend = unwrapMessage(targetToSend) || targetToSend;
        targetToSend = restoreMediaBuffers(targetToSend);

        const mtype = getContentType(targetToSend) || Object.keys(targetToSend || {})[0] || '';
        const content = (mtype && targetToSend?.[mtype]) ? targetToSend[mtype] : targetToSend;

        if (mtype === 'conversation' || typeof content === 'string') {
            await client.sendMessage(sendChat, { text: typeof content === 'string' ? content : (content.text || '') });
        } else if (mtype === 'extendedTextMessage') {
            await client.sendMessage(sendChat, { text: content.text || '' });
        } else if (mtype === 'imageMessage' || targetToSend?.imageMessage) {
            const imgData = targetToSend.imageMessage || content;
            const buf = await downloadMedia(targetToSend);
            await client.sendMessage(sendChat, { image: buf, mimetype: imgData.mimetype || 'image/jpeg', caption: imgData.caption || '' });
        } else if (mtype === 'videoMessage' || targetToSend?.videoMessage) {
            const vidData = targetToSend.videoMessage || content;
            const buf = await downloadMedia(targetToSend);
            await client.sendMessage(sendChat, { video: buf, mimetype: vidData.mimetype || 'video/mp4', caption: vidData.caption || '' });
        } else if (mtype === 'stickerMessage' || targetToSend?.stickerMessage) {
            const buf = await downloadMedia(targetToSend);
            await client.sendMessage(sendChat, { sticker: buf });
        } else if (mtype === 'audioMessage' || targetToSend?.audioMessage) {
            const audData = targetToSend.audioMessage || content;
            const buf = await downloadMedia(targetToSend);
            await client.sendMessage(sendChat, { audio: buf, mimetype: audData.mimetype || 'audio/mp4', ptt: audData.ptt || false });
        } else if (mtype === 'documentMessage' || targetToSend?.documentMessage) {
            const docData = targetToSend.documentMessage || content;
            const buf = await downloadMedia(targetToSend);
            await client.sendMessage(sendChat, { document: buf, mimetype: docData.mimetype || 'application/octet-stream', fileName: docData.fileName || 'file', caption: docData.caption || '' });
        } else if (content?.text) {
            await client.sendMessage(sendChat, { text: content.text });
        } else {
            const out = typeof content === 'object' ? util.inspect(content, { depth: 3 }) : String(content);
            await client.sendMessage(sendChat, { text: out });
        }
    } catch (err) {
        console.error('[Plugin Q Error]', err);
        await reply(`❌ Gagal mengekstrak pesan: ${err.message}`);
    }
}

handler.command = ['q', 'ambilq', 'quoted'];
handler.category = 'Tools';
handler.desc = 'Ambil pesan yang di-reply oleh pesan lain';
handler.owner = false;
