import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import Crypto from 'crypto';
import { exec } from 'child_process';
import webp from 'node-webpmux';

const runFfmpeg = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, (error) => {
        if (error) reject(error);
        else resolve();
    });
});

export async function convertToWebp(buffer, mediaType = 'image') {
    const randomName = Crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
    const inputExt = mediaType === 'video' ? 'mp4' : 'jpg';
    const tmpIn = path.join(tmpdir(), `${randomName}_in.${inputExt}`);
    const tmpOut = path.join(tmpdir(), `${randomName}_out.webp`);

    fs.writeFileSync(tmpIn, buffer);

    try {
        if (mediaType !== 'video') {
            const cmd = `ffmpeg -v error -i "${tmpIn}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba" -lossless 0 -q:v 60 -y "${tmpOut}"`;
            await runFfmpeg(cmd);
            return fs.readFileSync(tmpOut);
        }

        const passes = [
            { scale: 512, fps: 12, q: 35, comp: 6 },
            { scale: 384, fps: 10, q: 25, comp: 6 },
            { scale: 320, fps: 8, q: 18, comp: 6 }
        ];
        let finalBuffer = null;
        for (const p of passes) {
            const cmd = `ffmpeg -v error -i "${tmpIn}" -vcodec libwebp -vf "scale=${p.scale}:${p.scale}:force_original_aspect_ratio=decrease,pad=${p.scale}:${p.scale}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba,fps=${p.fps}" -loop 0 -t 14 -an -lossless 0 -compression_level ${p.comp} -q:v ${p.q} -preset default -y "${tmpOut}"`;
            await runFfmpeg(cmd);
            finalBuffer = fs.readFileSync(tmpOut);
            if (finalBuffer.length < 870000) break;
        }
        return finalBuffer;
    } finally {
        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}
        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
    }
}

export async function addExif(webpSticker, packname = 'AMBATRON', author = '') {
    const img = new webp.Image();
    const json = {
        'sticker-pack-id': Crypto.randomBytes(32).toString('hex'),
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': ['']
    };
    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    await img.load(webpSticker);
    img.exif = exif;
    return await img.save(null);
}

export async function convertWebpToMedia(webpBuffer, isAnimated = false) {
    const randomName = Crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
    const ext = isAnimated ? 'mp4' : 'jpg';
    const tmpIn = path.join(tmpdir(), `${randomName}_stk.webp`);
    const tmpOut = path.join(tmpdir(), `${randomName}_out.${ext}`);

    fs.writeFileSync(tmpIn, webpBuffer);

    try {
        if (isAnimated) {
            const ffmpegCmd = `ffmpeg -v error -y -i "${tmpIn}" -pix_fmt yuv420p -c:v libx264 -movflags +faststart "${tmpOut}"`;
            await runFfmpeg(ffmpegCmd);
        } else {
            const ffmpegCmd = `ffmpeg -v error -y -i "${tmpIn}" -vcodec mjpeg "${tmpOut}"`;
            await runFfmpeg(ffmpegCmd);
        }

        const outBuf = fs.readFileSync(tmpOut);
        return { buffer: outBuf, isVideo: isAnimated };
    } finally {
        try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}
        try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
    }
}
