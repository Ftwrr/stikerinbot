const handler = async (m, { client, text, reply }) => {
    const name = text ? text.trim() : '';
    if (!name) {
        return reply(
            `⚠️ Masukkan nama tampilan (pushName) baru!\n\n` +
            `*Contoh:*\n` +
            `• *.setname Nama Saya*`
        );
    }

    if (name.length > 25) {
        return reply('⚠️ Nama tampilan terlalu panjang! Maksimal 25 karakter.');
    }

    try {
        await client.profile.setPushName(name);

        if (client.user) {
            client.user.name = name;
        }

        return reply(`✅ *Nama tampilan berhasil diubah menjadi:* *${name}*`);
    } catch (err) {
        console.error('[SetName Error]', err);
        return reply(`❌ Gagal mengubah nama tampilan: ${err.message || err}`);
    }
};

handler.help = ['setname <nama>'];
handler.tags = ['owner'];
handler.command = ['setname', 'setpushname', 'setbotname'];
handler.desc = 'Ubah nama tampilan (pushName) akun WhatsApp (Owner)';
handler.owner = true;

export default handler;
