import axios from 'axios';

const handler = async (m, { text, args, command, reply }) => {
    const sub = (args[0] || '').toLowerCase();
    const param1 = args[1] || '';
    const param2 = args[2] || '';

    if (!sub) {
        return reply(`🔍 *STALKER TOOLS*

Pilih target yang ingin di-stalk:
• *.stalk ff <id_game>* (Free Fire)
• *.stalk mlbb <id_game> <zone_id>* (Mobile Legends)
• *.stalk genshin <uid>* (Genshin Impact)
• *.stalk roblox <username>* (Roblox)
• *.stalk tiktok <username>* (TikTok)

*Contoh:*
• *.stalk ff 123456789*
• *.stalk mlbb 12345678 1234*
• *.stalk tiktok zansxart*

_Powered by https://api.zansxart.me_`);
    }

    if (m.react) await m.react('⏳');

    try {
        // 1. FREE FIRE
        if (sub === 'ff' || sub === 'freefire') {
            if (!param1) return reply('⚠️ Masukkan ID Free Fire! Contoh: *.stalk ff 123456789*');
            const apiUrl = global.API('zans', '/api/stalker/ff', { id: param1 });
            const res = await axios.get(apiUrl, { timeout: 20000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (!data || !data.nickname) throw new Error('ID Free Fire tidak ditemukan');

            const txt = `🎮 *FREE FIRE ID STALKER*

• ID Akun : *${param1}*
• Nickname : *${data.nickname || data.userName || '-'}*
• Wilayah : *${data.region || 'ID'}*

_Powered by api.zansxart.me_`;
            if (m.react) await m.react('✅');
            return reply(txt);
        }

        // 2. MOBILE LEGENDS (MLBB)
        if (sub === 'ml' || sub === 'mlbb' || sub === 'mobilelegends') {
            if (!param1 || !param2) return reply('⚠️ Masukkan ID dan Zone ID MLBB!\nContoh: *.stalk mlbb 12345678 1234*');
            const apiUrl = global.API('zans', '/api/stalker/mlbb', { id: param1, zoneId: param2 });
            const res = await axios.get(apiUrl, { timeout: 20000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (!data || !data.userName) throw new Error('Akun Mobile Legends tidak ditemukan');

            const txt = `⚔️ *MOBILE LEGENDS STALKER*

• ID Game : *${param1}*
• Zone ID : *(${param2})*
• Nickname : *${data.userName || data.nickname || '-'}*

_Powered by api.zansxart.me_`;
            if (m.react) await m.react('✅');
            return reply(txt);
        }

        // 3. GENSHIN IMPACT
        if (sub === 'genshin' || sub === 'gi') {
            if (!param1) return reply('⚠️ Masukkan UID Genshin Impact! Contoh: *.stalk genshin 800123456*');
            const apiUrl = global.API('zans', '/api/stalker/genshin', { uid: param1 });
            const res = await axios.get(apiUrl, { timeout: 20000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (!data) throw new Error('UID Genshin Impact tidak ditemukan');

            const txt = `✨ *GENSHIN IMPACT STALKER*

• UID : *${param1}*
• Nickname : *${data.nickname || data.userName || data.name || '-'}*
• Level : *${data.level || '-'}*

_Powered by api.zansxart.me_`;
            if (m.react) await m.react('✅');
            return reply(txt);
        }

        // 4. ROBLOX
        if (sub === 'roblox') {
            if (!param1) return reply('⚠️ Masukkan Username Roblox! Contoh: *.stalk roblox Roblox*');
            const apiUrl = global.API('zans', '/api/stalker/roblox', { username: param1 });
            const res = await axios.get(apiUrl, { timeout: 20000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (!data) throw new Error('User Roblox tidak ditemukan');

            const txt = `🧱 *ROBLOX USER STALKER*

• Username : *${data.username || param1}*
• Display Name : *${data.displayName || '-'}*
• ID : *${data.id || '-'}*
• Deskripsi : ${data.description || '-'}

_Powered by api.zansxart.me_`;
            if (m.react) await m.react('✅');
            return reply(txt);
        }

        // 5. TIKTOK USER
        if (sub === 'tiktok' || sub === 'tt') {
            if (!param1) return reply('⚠️ Masukkan username TikTok! Contoh: *.stalk tiktok zansxart*');
            const cleanUser = param1.replace(/^@/, '');
            const apiUrl = global.API('zans', '/api/stalker/tiktok', { username: cleanUser });
            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (!data) throw new Error('Akun TikTok tidak ditemukan');

            const user = data.user || data;
            const stats = data.stats || {};

            const txt = `🎵 *TIKTOK PROFILE STALKER*

• Username : *@${user.uniqueId || cleanUser}*
• Nama : *${user.nickname || '-'}*
• Followers : *${(stats.followerCount || user.followers || 0).toLocaleString('id-ID')}*
• Following : *${(stats.followingCount || user.following || 0).toLocaleString('id-ID')}*
• Total Likes : *${(stats.heartCount || user.likes || 0).toLocaleString('id-ID')}*
• Bio : ${user.signature || user.bio || '-'}

_Powered by api.zansxart.me_`;
            if (m.react) await m.react('✅');
            return reply(txt);
        }

        return reply('⚠️ Kategori stalker tidak valid! Ketik *.stalk* untuk melihat daftar kategori yang tersedia.');
    } catch (err) {
        console.error('[Stalker Error]', err);
        if (m.react) await m.react('❌');
        await reply(`❌ Gagal melakukan stalking: ${err.message}`);
    }
};

handler.command = ['stalk', 'stalker'];
handler.category = 'Tools';
handler.desc = 'Stalking akun game dan medsos via api.zansxart.me';
handler.limit = 1;
export default handler;
