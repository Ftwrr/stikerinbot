const handler = async (m, { client, text, reply }) => {
    const statusText = text ? text.trim() : '';
    if (!statusText) {
        return reply(
            `⚠️ Masukkan teks Bio/About baru!\n\n` +
            `*Contoh:*\n` +
            `• *.setbio Hai, saya menggunakan WhatsApp.*`
        );
    }

    if (statusText.length > 139) {
        return reply('⚠️ Teks bio terlalu panjang! WhatsApp membatasi status bio maksimal 139 karakter.');
    }

    try {
        await client.profile.setStatus(statusText);
        return reply(`✅ *Bio berhasil diubah menjadi:*\n"${statusText}"`);
    } catch (err) {
        console.error('[SetBio Error]', err);
        return reply(`❌ Gagal mengubah bio: ${err.message || err}`);
    }
};

handler.help = ['setbio <teks>'];
handler.tags = ['owner'];
handler.command = ['setbio', 'setabout'];
handler.desc = 'Ubah status teks bio/about akun WhatsApp (Owner)';
handler.owner = true;

export default handler;
