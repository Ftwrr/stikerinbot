import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import Crypto from 'crypto';

/**
 * Menyiapkan buffer gambar menjadi JPEG persegi (square) 640x640
 * sesuai format native yang diharapkan oleh protokol WhatsApp.
 */
async function toSquareJpeg(buffer) {
    const randomName = Crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
    const tmpIn = path.join(tmpdir(), `${randomName}_pp_in`);
    const tmpOut = path.join(tmpdir(), `${randomName}_pp_out.jpg`);

    fs.writeFileSync(tmpIn, buffer);
    const ffmpegCmd = `ffmpeg -v error -y -i "${tmpIn}" -vf "scale=640:640:force_original_aspect_ratio=decrease,pad=640:640:(ow-iw)/2:(oh-ih)/2:color=black" -q:v 2 "${tmpOut}"`;

    try {
        await new Promise((resolve, reject) => {
            exec(ffmpegCmd, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        return fs.readFileSync(tmpOut);
    } finally {
        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
    }
}

const handler = async (m, { client, command, reply }) => {
    const cmd = (command || '').toLowerCase();

    try {
        if (cmd === 'delpp' || cmd === 'delppbot' || cmd === 'hapuspp' || cmd === 'hapusppbot') {
            await client.profile.deleteProfilePicture();
            return reply('✅ *Foto profil berhasil dihapus!* (Kembali ke avatar default).');
        }

        // setpp
        const targetMsg = m.quoted ? m.quoted : m;
        const mtype = targetMsg.mtype || '';
        const isImage = mtype === 'imageMessage' || targetMsg.msg?.mimetype?.startsWith('image/');

        if (!isImage) {
            return reply('⚠️ Balas/reply atau kirim foto dengan perintah *.setpp* untuk mengganti foto profil.');
        }

        await reply('⏳ Sedang memproses dan memperbarui foto profil...');

        let mediaBuf;
        try {
            mediaBuf = await targetMsg.download();
        } catch (e) {
            return reply(`❌ Gagal mengunduh gambar: ${e.message}`);
        }

        if (!mediaBuf || !mediaBuf.length) {
            return reply('❌ Gagal memuat buffer gambar media.');
        }

        const jpegBuf = await toSquareJpeg(mediaBuf);
        const picId = await client.profile.setProfilePicture(new Uint8Array(jpegBuf));

        return reply(`✅ *Foto profil berhasil diperbarui!*${picId ? `\n• Picture ID: ${picId}` : ''}`);
    } catch (err) {
        console.error('[SetPP Error]', err);
        return reply(`❌ Gagal: ${err.message || err}`);
    }
};

handler.help = ['setpp', 'delpp'];
handler.tags = ['owner'];
handler.command = ['setpp', 'setppbot', 'setbotpp', 'delpp', 'delppbot', 'hapuspp', 'hapusppbot'];
handler.desc = 'Ganti atau hapus foto profil akun WhatsApp (Owner)';
handler.owner = true;

export default handler;
