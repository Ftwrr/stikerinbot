import axios from 'axios';
import { saveActiveGame, removeActiveGame } from '../../lib/game_manager.js';

const handler = async (m, { client, from, reply }) => {
    try {
        global.game = global.game || {};
        if (global.game[from]) {
            return reply('⚠️ Masih ada game yang sedang berjalan di chat ini!\nJawab langsung atau ketik *.nyerah* untuk menyerah.');
        }

        const apiUrl = global.API('zans', '/api/game/caklontong');
        const res = await axios.get(apiUrl, { timeout: 15000 });

        const data = res.data?.data || res.data?.result;
        if (!data || !data.soal || !data.jawaban) {
            return reply('❌ Gagal mengambil soal Cak Lontong dari API.');
        }

        global.gameHistory = global.gameHistory || new Map();
        if (global.gameHistory.has(from)) {
            const lastMsgId = global.gameHistory.get(from);
            if (lastMsgId) {
                await client.sendMessage(from, { delete: { id: lastMsgId, fromMe: true } }).catch(() => {});
            }
            global.gameHistory.delete(from);
        }

        const sentMsg = await client.sendMessage(from, {
            text: `🤔 *KUIS CAK LONTONG*

${data.soal}

⏰ *Waktu:* 3 Menit | 🎁 *Hadiah:* +20 EXP
Ketik jawabanmu langsung di chat ini.
Ketik *.nyerah* jika menyerah (-1 limit) 😅

_Powered by api.zansxart.me_`
        }, { quoted: { key: m.key } });

        const sentMsgId = sentMsg?.id || sentMsg?.key?.id;

        const gameData = {
            type: 'caklontong',
            soalMsgId: sentMsgId,
            jawaban: String(data.jawaban).toLowerCase().trim(),
            deskripsi: data.deskripsi || '',
            poin: 20,
            user: m.sender,
            waktu: Date.now(),
            timeout: setTimeout(async () => {
                if (global.game[from]) {
                    const timeoutRes = await client.sendMessage(from, {
                        text: `⏰ *Waktu Habis!*

Tidak ada yang berhasil menjawab tepat waktu.
Jawaban yang benar: *${data.jawaban.toUpperCase()}*
${data.deskripsi ? `💡 *Alasan:* ${data.deskripsi}` : ''}

Ingin coba lagi? Ketik *.caklontong*`
                    }, { quoted: { key: m.key } }).catch(() => {});

                    if (timeoutRes?.id || timeoutRes?.key?.id) {
                        global.gameHistory.set(from, timeoutRes.id || timeoutRes.key.id);
                    }
                    delete global.game[from];
                    removeActiveGame(from);
                }
            }, 180000)
        };

        global.game[from] = gameData;
        saveActiveGame(from, gameData);
    } catch (err) {
        console.error('[Caklontong API Error]', err.message);
        reply('❌ Gagal memuat game Cak Lontong: ' + err.message);
    }
};

handler.command = ['caklontong', 'kuislontong'];
handler.category = 'Games';
handler.desc = 'Kuis teka-teki logika jenaka Cak Lontong via api.zansxart.me';
handler.limit = false;
export default handler;
