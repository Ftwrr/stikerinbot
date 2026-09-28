import axios from 'axios';

const CHARACTER_MAP = {
    'jokowi': 'Jokowi',
    'jkw': 'Jokowi',
    'prabowo': 'Prabowo',
    'bowo': 'Prabowo',
    'megawati': 'Megawati',
    'mega': 'Megawati',
    'anies': 'Anies',
    'onah': 'Onah'
};

const handler = async (m, { client, from, text, args, reply }) => {
    let characterInput = (args[0] || '').toLowerCase();
    let textToSpeak = args.slice(1).join(' ').trim();

    if (!textToSpeak && m.quoted) {
        textToSpeak = (m.quoted.text || m.quoted.caption || '').trim();
    }

    const availableChars = Object.keys(CHARACTER_MAP).filter((v, i, a) => a.indexOf(v) === i).join(', ');

    if (!characterInput || !CHARACTER_MAP[characterInput] || !textToSpeak) {
        return reply(`⚠️ Format salah! Gunakan:
*.aivoice <tokoh> <teks>*

*Tokoh yang tersedia:*
• ${availableChars}

*Contoh:*
• *.aivoice jokowi selamat pagi rakyat indonesia*
• Reply pesan teks dengan: *.aivoice prabowo*

_Powered by https://api.zansxart.me_`);
    }

    if (textToSpeak.length > 250) {
        return reply('⚠️ Teks terlalu panjang! Maksimal 250 karakter agar suara jernih.');
    }

    if (m.react) await m.react('⏳');

    try {
        const charName = CHARACTER_MAP[characterInput];
        const apiUrl = global.API('zans', '/api/ai/aivoice', {
            character: charName,
            text: textToSpeak
        });

        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 45000
        });

        if (!res.data || res.data.length < 500) {
            throw new Error('Data audio dari API tidak valid');
        }

        const audioBuffer = Buffer.from(res.data);

        await client.sendMessage(from, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: true
        }, { quoted: { key: m.key } });

        if (m.react) await m.react('✅');
    } catch (err) {
        console.error('[AI Voice Error]', err);
        if (m.react) await m.react('❌');
        await reply(`❌ Gagal menghasilkan suara AI: ${err.message}`);
    }
};

handler.command = ['aivoice', 'vnai', 'suaraai'];
handler.category = 'AI';
handler.desc = 'Mengubah teks menjadi VN suara tokoh (Jokowi, Prabowo, Megawati, Anies, Onah) via api.zansxart.me';
handler.limit = 1;
export default handler;
