import { downloadWithZans } from '../../lib/zans_downloader.js';

const socialMediaRegex = /https?:\/\/[^\s]+/i;

const handler = async (m, { client, from, text, args, command, reply }) => {
    let url = (args[0] || '').trim();
    if (!url && m.quoted && m.quoted.text) {
        const match = m.quoted.text.match(socialMediaRegex);
        if (match) url = match[0];
    }
    if (!url && text) {
        const match = text.match(socialMediaRegex);
        if (match) url = match[0];
    }

    if (!url || !/^https?:\/\//i.test(url)) {
        return reply(`⚠️ Masukkan link media sosmed yang valid!\n\n*Contoh:*\n• *.dl https://www.instagram.com/p/xxxx/*\n• *.dl https://vt.tiktok.com/xxxx/*\n• *.dl https://fb.watch/xxxx/*\n• *.dl https://x.com/xxxx/status/xxxx*\n\n_Powered by https://api.zansxart.me_`);
    }

    if (m.react) await m.react('⏳');
    const quotedMsg = { key: m.key };

    // ONLY ZANSXART DOWNLOADER API
    try {
        const zansRes = await downloadWithZans(url);
        if (zansRes && zansRes.media?.length > 0) {
            const rawTitle = (zansRes.title && zansRes.title.trim()) ? zansRes.title.trim() : '';
            const caption = rawTitle ? `${rawTitle}\n\n_Powered by api.zansxart.me_` : `_Powered by api.zansxart.me_`;

            for (const item of zansRes.media) {
                if (item.type === 'video') {
                    await client.sendMessage(from, { video: { url: item.url }, caption }, { quoted: quotedMsg });
                } else if (item.type === 'audio') {
                    await client.sendMessage(from, { audio: { url: item.url }, mimetype: 'audio/mpeg', fileName: `${zansRes.title || 'audio'}.mp3`, ptt: false }, { quoted: quotedMsg });
                } else {
                    await client.sendMessage(from, { image: { url: item.url }, caption }, { quoted: quotedMsg });
                }
            }
            if (m.react) await m.react('✅');
            return;
        }
    } catch (zansErr) {
        console.error('[ZansDownloader Error]', zansErr.message);
    }

    if (m.react) await m.react('❌');
    await reply('❌ Gagal mengunduh media dari link tersebut via api.zansxart.me. Pastikan link bersifat publik.');
};

handler.command = ['dl', 'download', 'tt', 'tiktok', 'ig', 'instagram', 'fb', 'facebook', 'tw', 'twitter', 'x', 'capcut', 'pin', 'pindl', 'spotify', 'yt', 'ytmp3', 'ytmp4', 'youtube'];
handler.category = 'Downloader';
handler.desc = 'Download video/foto/audio TikTok, IG, FB, X, CapCut, Spotify, YouTube via api.zansxart.me';
export default handler;
