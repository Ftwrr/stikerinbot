import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import Crypto from 'crypto';
import { exec } from 'child_process';

/**
 * Mengonversi buffer audio (MP3/WAV/AAC) menjadi format Voice Note WhatsApp (Opus in Ogg container)
 */
export function convertToVoiceNote(buffer) {
    return new Promise((resolve, reject) => {
        const randomName = Crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
        const tmpIn = path.join(tmpdir(), `${randomName}_in.mp3`);
        const tmpOut = path.join(tmpdir(), `${randomName}_out.opus`);

        fs.writeFileSync(tmpIn, buffer);

        // FFmpeg konversi ke audio Opus mono 48kHz (spesifikasi resmi WhatsApp PTT)
        const cmd = `ffmpeg -y -i "${tmpIn}" -c:a libopus -b:a 32k -vbr on -compression_level 10 -ar 48000 -ac 1 "${tmpOut}"`;

        exec(cmd, (error) => {
            try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}

            if (error) {
                try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
                reject(error);
            } else {
                try {
                    const outBuf = fs.readFileSync(tmpOut);
                    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
                    resolve(outBuf);
                } catch (e) {
                    reject(e);
                }
            }
        });
    });
}
