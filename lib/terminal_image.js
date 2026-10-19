import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import Crypto from 'crypto';

/**
 * Konversi buffer gambar (JPEG, PNG, WebP) menjadi representasi ANSI Truecolor
 * di terminal menggunakan FFmpeg (yang sudah terpasang di sistem).
 * 
 * Menggunakan karakter blok Unicode half-block (▀) dengan 24-bit Truecolor
 * sehingga setiap baris karakter menampilkan dua piksel vertikal (atas & bawah).
 * 100% Zero external dependencies!
 */
/**
 * Ambil dimensi asli gambar (width & height) menggunakan ffprobe
 */
function probeImageDimensions(filePath) {
    return new Promise((resolve) => {
        const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`;
        exec(cmd, { timeout: 5000 }, (err, stdout) => {
            if (err || !stdout) return resolve(null);
            const [w, h] = stdout.trim().split('x').map(Number);
            if (w && h && !isNaN(w) && !isNaN(h)) {
                resolve({ w, h });
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * Konversi buffer gambar (JPEG, PNG, WebP) menjadi representasi ANSI Truecolor
 * di terminal menggunakan FFmpeg (yang sudah terpasang di sistem).
 *
 * Mengikuti aspek rasio asli gambar (tanpa blackbar samping/atas) dan
 * menyesuaikan secara proporsional dengan lebar terminal saat ini.
 */
export async function renderTerminalImage(buffer, options = {}) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return '';

    const randomName = Crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
    const tmpIn = path.join(tmpdir(), `${randomName}_timg_in`);
    const tmpOut = path.join(tmpdir(), `${randomName}_timg_out.raw`);

    try {
        fs.writeFileSync(tmpIn, buffer);

        // 1. Dapatkan dimensi asli media
        const orig = await probeImageDimensions(tmpIn);
        const origW = orig?.w || 100;
        const origH = orig?.h || 100;

        // 2. Tentukan batas maksimal terminal
        // Dalam font terminal monospace, satu sel karakter rata-rata memiliki
        // rasio lebar:tinggi = 1:2 (tinggi sel dua kali lebar sel).
        // Karena satu karakter half-block '▀' menampilkan DUA piksel vertikal (atas & bawah),
        // sebuah karakter terminal berbentuk bujur sangkar (1 unit lebar karakter x 1 unit tinggi karakter).
        // Oleh karena itu:
        // Rasio aspek visual terminal = cols / rows = imgAspect (origW / origH).
        // Sedangkan piksel vertikal gambar asli (pixelHeight) = rows * 2.
        //
        // Rumus perbandingan:
        // rows = Math.round(cols / imgAspect)
        // cols = Math.round(rows * imgAspect * 2)  <-- SEBELUMNYA TIDAK DIKALI 2 SAAT NORMALISASI FONT
        const termCols = process.stdout.columns || 80;
        const maxCols = options.maxWidth || Math.min(Math.max(termCols - 6, 36), 64);
        const maxRows = options.maxHeight || 30;

        // Font aspect ratio factor: Karakter terminal lebarnya ~0.5 dari tingginya.
        // Dengan 2 piksel per karakter (half-block), 1 karakter baris = 2 piksel tinggi.
        // Untuk menjaga proporsi visual 1:1 antara lebar dan tinggi:
        const imgAspect = origW / origH;
        let cols = Math.round(imgAspect * maxRows * 2);
        let rows = maxRows;

        if (cols > maxCols) {
            cols = maxCols;
            rows = Math.round(cols / (imgAspect * 2));
        }

        cols = Math.max(cols, 10);
        rows = Math.max(rows, 6);
        const pixelHeight = rows * 2; // Tiap baris teks memuat 2 piksel vertikal

        // 4. Skalasi gambar persis sesuai cols x pixelHeight (tanpa distorsi / tanpa pad hitam)
        const vf = `scale=${cols}:${pixelHeight}:flags=lanczos,unsharp=5:5:0.8:5:5:0.0`;
        const cmd = `ffmpeg -v error -y -i "${tmpIn}" -vf "${vf}" -f rawvideo -pix_fmt rgb24 "${tmpOut}"`;

        await new Promise((resolve, reject) => {
            exec(cmd, { timeout: 10000 }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (!fs.existsSync(tmpOut)) return '';

        const rawBytes = fs.readFileSync(tmpOut);
        const expectedBytes = cols * pixelHeight * 3;
        if (rawBytes.length < expectedBytes) return '';

        let result = '';
        const RESET = '\x1b[0m';

        // Render baris karakter half-block
        for (let y = 0; y < rows; y++) {
            const topY = y * 2;
            const bottomY = topY + 1;
            let line = '  ';

            for (let x = 0; x < cols; x++) {
                const topIdx = (topY * cols + x) * 3;
                const tr = rawBytes[topIdx];
                const tg = rawBytes[topIdx + 1];
                const tb = rawBytes[topIdx + 2];

                const btmIdx = (bottomY * cols + x) * 3;
                const br = rawBytes[btmIdx];
                const bg = rawBytes[btmIdx + 1];
                const bb = rawBytes[btmIdx + 2];

                line += `\x1b[38;2;${tr};${tg};${tb}m\x1b[48;2;${br};${bg};${bb}m▀`;
            }
            line += RESET;
            result += line + '\n';
        }

        return result;
    } catch (_) {
        return '';
    } finally {
        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (_) {}
        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (_) {}
    }
}

export default {
    renderTerminalImage
};
