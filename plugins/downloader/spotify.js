import { getSpotify } from '../../lib/spotify.js';

const handler = async (m, { client, from, text, usedPrefix, command, reply }) => {
    let input = (text || '').trim();
    if (!input && m.quoted) {
        input = (m.quoted.text || m.quoted.caption || '').trim();
    }

    if (!input) {
        return reply(`⚠️ Masukkan judul lagu atau link Spotify!\n\n*Contoh:*\n• *${usedPrefix || '.'}${command} Faded Alan Walker*\n• *${usedPrefix || '.'}${command} https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3*`);
    }

    if (m.react) await m.react('⏳');
    const quotedMsg = { key: m.key };

    try {
        const track = await getSpotify(input);

        const caption = `🎵 *SPOTIFY DOWNLOADER*\n\n` +
            `• *Judul:* ${track.title || '-'}\n` +
            `• *Artis:* ${track.artist || '-'}\n` +
            `• *Durasi:* ${track.duration || '-'}\n` +
            (track.album ? `• *Album:* ${track.album}\n` : '') +
            (track.date ? `• *Rilis:* ${track.date}\n` : '') +
            `• *Link:* ${track.spotify}\n\n` +
            `_Sedang mengirim audio..._`;

        if (track.cover) {
            await client.sendMessage(from, { image: { url: track.cover }, caption }, { quoted: quotedMsg });
        } else {
            await reply(caption);
        }

        await client.sendMessage(from, {
            audio: { url: track.download },
            mimetype: 'audio/mpeg',
            fileName: `${track.title} - ${track.artist}.mp3`,
            ptt: false
        }, { quoted: quotedMsg });

        if (m.react) await m.react('✅');
    } catch (err) {
        console.error('[Spotify Downloader Error]', err.message);
        if (m.react) await m.react('❌');
        await reply(`❌ ${err.message || 'Gagal mengunduh lagu dari Spotify.'}`);
    }
};

handler.command = ['spotify', 'spotidown', 'spotplay', 'sp'];
handler.help = ['spotify <judul/link>'];
handler.tags = ['downloader'];
handler.desc = 'Cari dan download audio/lagu dari Spotify';
handler.limit = 1;

export default handler;
