import { convertToWebp, addExif, convertWebpToMedia } from '../../lib/converter.js';
import axios from 'axios';

async function generateQcApi(name, text, avatarUrl = null) {
    try {
        const query = {
            text,
            name: name || 'User',
            color: '#202c33'
        };
        if (avatarUrl) query.avatar = avatarUrl;

        const url = global.API('zans', '/api/maker/qc', query);
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000
        });

        if (res.data && res.data.length > 500) {
            return Buffer.from(res.data);
        }
    } catch (e) {
        console.error('[QC API Zans Error]', e.message);
    }
    return null;
}

const handler = async (m, { client, from, text, reply }) => {
    let caption = text ? text.trim() : '';
    const q = m.quoted || m;

    if (!caption && m.quoted) {
        caption = m.quoted.text || '';
    }

    if (!caption) {
        return reply('⚠️ Masukkan teks atau balas pesan teks dengan *.qc*\n\n_Powered by https://api.zansxart.me_');
    }

    let targetName = '';
    if (m.quoted) {
        targetName = m.quoted.pushName || m.quoted.name || '';
    } else {
        targetName = m.pushName || m.name || '';
    }

    if (!targetName || targetName.includes('@lid') || /^\d{14,}$/.test(targetName)) {
        const targetSender = m.quoted ? m.quoted.sender : m.sender;
        const dbUser = global.db?.data?.users?.[targetSender];
        targetName = dbUser?.name || (targetSender && !targetSender.includes('@lid') ? `+${targetSender.split('@')[0]}` : 'User');
    }

    if (targetName.includes('@')) {
        targetName = targetName.split('@')[0];
    }

    try {
        const targetSenderJid = m.quoted ? m.quoted.sender : m.sender;
        let ppUrl = null;

        try {
            const ppRes = await client.profile?.getProfilePicture?.(targetSenderJid, 'preview').catch(() => null);
            ppUrl = ppRes?.url || (typeof ppRes === 'string' ? ppRes : null);
        } catch (e) {}

        const pngBuffer = await generateQcApi(targetName, caption, ppUrl);
        if (!pngBuffer) {
            return reply('❌ Gagal membuat quote chat via api.zansxart.me');
        }

        const webpSticker = await convertToWebp(pngBuffer, 'image');
        const exifBuffer = await addExif(webpSticker, "api.zansxart.me");
        await client.sendMessage(from, { sticker: exifBuffer }, { quoted: { key: m.key } });
    } catch (err) {
        console.error('[QC Error]', err);
        await reply(`❌ Gagal membuat quote sticker: ${err.message}`);
    }
};

handler.command = ['qc', 'qcc'];
handler.category = 'Maker';
handler.desc = 'Quote chat sticker via api.zansxart.me';
export default handler;
