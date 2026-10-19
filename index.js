import './lib/config.js';
import { WaClient, createStore, createPinoLogger, WA_DISCONNECT_REASONS, fetchLatestWaWebVersion, downloadMediaMessage, unwrapMessage, getContentType } from 'zapo-js';
import { createSqliteStore } from '@zapo-js/store-sqlite';
import { createMediaProcessor } from '@zapo-js/media-utils';
import './lib/database.js';
import fs from 'fs';
import { exec } from 'child_process';
import { tmpdir } from 'os';
import path from 'path';
import Crypto from 'crypto';
import webp from 'node-webpmux';
import axios from 'axios';
import * as cheerio from 'cheerio';
import qrcode from 'qrcode-terminal';

import { resolvePhoneNumberFromMsg, resolvePhoneNumberFromLid } from './lib/lid_helper.js';
import { restoreClonedSessions } from './lib/jadibot_zapo.js';
import { loadPlugins, startPluginWatcher, handlePluginMessage } from './lib/plugin_manager.js';
import { smsg } from './lib/simple.js';
import { getRichHandler } from './lib/rich_handler.js';
import { handleDeadPlayerChat, restoreWwGames } from './lib/werewolf.js';
import { getBotSettings } from './lib/settings.js';
import { startBannedExpiryScheduler } from './lib/banned_scheduler.js';
import { evaluateAntiCall } from './lib/anti_call.js';
import { messageCache } from './lib/message_cache.js';
import { printMessageLog, logger } from './lib/logger.js';
import { renderTerminalImage } from './lib/terminal_image.js';
import { getGroupName } from './lib/group_utils.js';

const AUTH_DIR_NAME = process.env.SESSION_DIR || "session_auth";

let client = null;
const chatNameCache = new Map();

function saveToStore(msg) {
    messageCache.save(msg);
}

function getFromStore(id) {
    return messageCache.get(id);
}

function cleanOldCache() {
    messageCache.clean();
}

function getCustomNameDb() {
    const dbFile = './db/user-names.json';
    if (fs.existsSync(dbFile)) {
        try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch (e) {}
    }
    return {};
}

function setCustomName(userId, name) {
    const dbFile = './db/user-names.json';
    const db = getCustomNameDb();
    const cleanId = String(userId).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    db[cleanId] = name.trim();
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
}

function resolveUserDisplayName(senderJid, pushName = null) {
    const db = getCustomNameDb();
    const cleanJid = String(senderJid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (db[cleanJid]) return db[cleanJid];
    const realPhone = resolvePhoneNumberFromMsg({ key: { participant: senderJid, remoteJid: senderJid } });
    if (realPhone && db[realPhone]) return db[realPhone];
    if (pushName && typeof pushName === 'string' && pushName.trim().length > 0 && !pushName.startsWith('+') && !/^[0-9]{14,}$/.test(pushName)) {
        return pushName.trim();
    }
    if (realPhone) return '+' + realPhone;
    if (cleanJid && cleanJid.length >= 10 && cleanJid.length <= 13) return '+' + cleanJid;
    return 'User';
}

function getAutoReadStatusSetting() {
    const settingFile = `./db/settings-${AUTH_DIR_NAME}.json`;
    if (fs.existsSync(settingFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(settingFile, 'utf8'));
            return typeof data.autoReadStatus === 'boolean' ? data.autoReadStatus : true;
        } catch (e) {}
    }
    return true;
}

function setAutoReadStatusSetting(enabled) {
    const settingFile = `./db/settings-${AUTH_DIR_NAME}.json`;
    let data = {};
    if (fs.existsSync(settingFile)) {
        try { data = JSON.parse(fs.readFileSync(settingFile, 'utf8')); } catch (e) {}
    }
    data.autoReadStatus = enabled;
    fs.writeFileSync(settingFile, JSON.stringify(data, null, 2), 'utf8');
}

function getRealMessage(message) {
    if (!message) return message;
    if (message.ephemeralMessage?.message) return getRealMessage(message.ephemeralMessage.message);
    if (message.viewOnceMessage?.message) return getRealMessage(message.viewOnceMessage.message);
    if (message.viewOnceMessageV2?.message) return getRealMessage(message.viewOnceMessageV2.message);
    if (message.viewOnceMessageV2Extension?.message) return getRealMessage(message.viewOnceMessageV2Extension.message);
    if (message.documentWithCaptionMessage?.message) return getRealMessage(message.documentWithCaptionMessage.message);
    return message;
}

function checkIfViewOnce(message) {
    if (!message) return false;
    if (message.viewOnceMessage || message.viewOnceMessageV2 || message.viewOnceMessageV2Extension) return true;
    if (message.ephemeralMessage?.message) return checkIfViewOnce(message.ephemeralMessage.message);
    if (message.documentWithCaptionMessage?.message) return checkIfViewOnce(message.documentWithCaptionMessage.message);
    if (message.imageMessage?.viewOnce) return true;
    if (message.videoMessage?.viewOnce) return true;
    if (message.audioMessage?.viewOnce) return true;
    return false;
}

function getMessageType(msg) {
    const content = getRealMessage(msg.message);
    if (!content) return 'Other';
    if (content.conversation || content.extendedTextMessage?.text) return 'Text';
    if (content.imageMessage) return 'Image';
    if (content.stickerMessage) return 'Sticker';
    if (content.audioMessage) return 'Audio';
    if (content.videoMessage) return content.videoMessage.gifPlayback ? 'GIF' : 'Video';
    if (content.documentMessage) {
        const mime = content.documentMessage.mimetype || '';
        if (mime.startsWith('image/')) return 'Image (File)';
        if (mime.startsWith('video/')) return 'Video (File)';
        return 'Document';
    }
    return 'Other';
}

function getMessageText(msg) {
    const content = getRealMessage(msg.message);
    if (!content) return '';
    return content.conversation ||
           content.extendedTextMessage?.text ||
           content.imageMessage?.caption ||
           content.videoMessage?.caption ||
           content.documentMessage?.caption ||
           content.buttonsResponseMessage?.selectedButtonId ||
           content.listResponseMessage?.singleSelectReply?.selectedRowId ||
           content.templateButtonReplyMessage?.selectedId ||
           '';
}

function isTargetUser(senderJid) {
    return false;
}

async function reportErrorToGroup(errorMessage, senderJid, msgKey = null) {
    if (!client) return;
    try {
        if (msgKey) {
            const targetJid = msgKey.remoteJidAlt || msgKey.remoteJid;
            await client.sendMessage(targetJid, { reactionMessage: { key: msgKey, text: '❌' } }).catch(() => {});
        }
    } catch (err) {
        console.error("[Report Error]", err);
    }
}

async function convertToWebp(buffer, mediaType) {
    const randomName = Crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
    const inputExt = mediaType === 'video' ? 'mp4' : 'jpg';
    const tmpIn = path.join(tmpdir(), `${randomName}_in.${inputExt}`);
    const tmpOut = path.join(tmpdir(), `${randomName}_out.webp`);
    fs.writeFileSync(tmpIn, buffer);
    const runFfmpeg = (cmd) => new Promise((resolve, reject) => {
        exec(cmd, (error) => { if (error) reject(error); else resolve(); });
    });
    try {
        if (mediaType !== 'video') {
            const cmd = `ffmpeg -i "${tmpIn}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba" -lossless 0 -q:v 60 -y "${tmpOut}"`;
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
            const cmd = `ffmpeg -i "${tmpIn}" -vcodec libwebp -vf "scale=${p.scale}:${p.scale}:force_original_aspect_ratio=decrease,pad=${p.scale}:${p.scale}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba,fps=${p.fps}" -loop 0 -t 14 -an -lossless 0 -compression_level ${p.comp} -q:v ${p.q} -preset default -y "${tmpOut}"`;
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

async function addExif(webpSticker, packname) {
    const img = new webp.Image();
    const json = {
        "sticker-pack-id": Crypto.randomBytes(32).toString("hex"),
        "sticker-pack-name": packname,
        "sticker-pack-publisher": "",
        "emojis": [""]
    };
    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    await img.load(webpSticker);
    img.exif = exif;
    return await img.save(null);
}

async function convertWebpToMedia(webpBuffer, isAnimated = false) {
    const randomName = Crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
    const ext = isAnimated ? 'mp4' : 'jpg';
    const tmpOut = path.join(tmpdir(), `${randomName}_out.${ext}`);
    let tmpIn = '';

    let inputBuf = webpBuffer;
    if (isAnimated) {
        try {
            inputBuf = await sharp(webpBuffer, { animated: true }).gif().toBuffer();
            tmpIn = path.join(tmpdir(), `${randomName}_stk.gif`);
        } catch (e) {
            tmpIn = path.join(tmpdir(), `${randomName}_stk.webp`);
        }
    } else {
        tmpIn = path.join(tmpdir(), `${randomName}_stk.webp`);
    }
    fs.writeFileSync(tmpIn, inputBuf);

    let ffmpegCmd = isAnimated
        ? `ffmpeg -y -i "${tmpIn}" -pix_fmt yuv420p -c:v libx264 -movflags +faststart "${tmpOut}"`
        : `ffmpeg -y -i "${tmpIn}" -vcodec mjpeg "${tmpOut}"`;

    return new Promise((resolve, reject) => {
        exec(ffmpegCmd, (error) => {
            try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch (e) {}
            if (error) {
                try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch (e) {}
                reject(error);
            } else {
                try {
                    const outBuf = fs.readFileSync(tmpOut);
                    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
                    resolve({ buffer: outBuf, isVideo: isAnimated });
                } catch (e) { reject(e); }
            }
        });
    });
}

async function downloadMsgMedia(msg, type) {
    let target = msg?.message || msg;
    target = unwrapMessage(target) || target;

    let media = (type && target?.[`${type}Message`]) || target?.imageMessage || target?.videoMessage || target?.audioMessage || target?.stickerMessage || target?.documentMessage;

    if (!media && target?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = unwrapMessage(target.extendedTextMessage.contextInfo.quotedMessage) || target.extendedTextMessage.contextInfo.quotedMessage;
        target = quoted;
        media = (type && target?.[`${type}Message`]) || target?.imageMessage || target?.videoMessage || target?.audioMessage || target?.stickerMessage || target?.documentMessage;
    }

    if (!media) throw new Error(`No ${type || 'media'} message found`);

    const stream = await downloadMediaMessage(target);
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function handleStickerCommand(msg, customClient = null) {
    const from = msg.key.remoteJidAlt || msg.key.remoteJid;
    const messageContent = getRealMessage(msg.message);
    let mediaMessage = null;
    let downloadType = null;
    let actualType = null;

    const processMessage = (content) => {
        if (content?.imageMessage) { mediaMessage = content.imageMessage; downloadType = 'image'; actualType = 'image'; }
        else if (content?.videoMessage) { mediaMessage = content.videoMessage; downloadType = 'video'; actualType = 'video'; }
        else if (content?.stickerMessage) { mediaMessage = content.stickerMessage; downloadType = 'sticker'; actualType = 'sticker'; }
        else if (content?.documentMessage) {
            const mime = content.documentMessage.mimetype || '';
            if (mime.startsWith('image/')) { mediaMessage = content.documentMessage; downloadType = 'document'; actualType = 'image'; }
            else if (mime.startsWith('video/')) { mediaMessage = content.documentMessage; downloadType = 'document'; actualType = 'video'; }
        }
    };

    processMessage(messageContent);
    if (!mediaMessage && messageContent?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = getRealMessage(messageContent.extendedTextMessage.contextInfo.quotedMessage);
        processMessage(quoted);
    }

    const quotedMsg = { ...msg, key: { ...msg.key, remoteJid: from } };

    if (!mediaMessage) {
        await reportErrorToGroup('Tidak ada media dikirim bersama command stiker', from, msg.key);
        return;
    }

    try {
        const buffer = await downloadMsgMedia(msg, actualType);
        if (actualType === 'sticker') {
            const exifBuffer = await addExif(buffer, "AMBATRON");
            await (customClient || client).sendMessage(from, { sticker: exifBuffer }, { quoted: quotedMsg });
        } else {
            const webpBuffer = await convertToWebp(buffer, actualType);
            const exifBuffer = await addExif(webpBuffer, "AMBATRON");
            await (customClient || client).sendMessage(from, { sticker: exifBuffer }, { quoted: quotedMsg });
        }
    } catch (err) {
        console.error("Error creating/sending sticker:", err);
        await reportErrorToGroup(err.message || 'Gagal membuat sticker', from, msg.key);
    }
}

async function handleQcCommand(msg) {
    const from = msg.key.remoteJid;
    const quotedMsg = { ...msg, key: { ...msg.key, remoteJid: from } };
    const content = getRealMessage(msg.message);
    let caption = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
    caption = caption.replace(/^\.qc(c)?/i, '').trim();
    let targetQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let targetMsg = targetQuoted ? getRealMessage(targetQuoted) : null;
    if (!caption && targetMsg) {
        caption = targetMsg.conversation || targetMsg.extendedTextMessage?.text || targetMsg.imageMessage?.caption || '';
    }
    let isImage = Boolean(content?.imageMessage || targetMsg?.imageMessage);
    let mediaBuffer = null;
    if (isImage) {
        try {
            const targetMediaMsg = content?.imageMessage ? msg : { message: targetQuoted, key: msg.key };
            const buf = await downloadMsgMedia(targetMediaMsg, 'image');
            mediaBuffer = buf;
        } catch (e) {}
    }
    if (!caption && !mediaBuffer) {
        return client.sendMessage(from, { text: '⚠️ Masukkan teks atau reply pesan/gambar dengan caption *.qc*' }, { quoted: quotedMsg });
    }
    const isQuoting = Boolean(msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);
    let targetSender = '';
    let rawPushName = null;
    if (isQuoting) {
        targetSender = msg.message.extendedTextMessage.contextInfo.participant || msg.message.extendedTextMessage.contextInfo.remoteJid || '';
        rawPushName = msg.message.extendedTextMessage.contextInfo.pushName || null;
    } else {
        targetSender = msg.key.participant || msg.key.remoteJid || '';
        rawPushName = msg.key.fromMe ? (client.user?.name || 'Me') : msg.pushName;
    }
    const targetName = resolveUserDisplayName(targetSender, rawPushName);
    try {
        let ppBuffer = null;
        try {
            const ppRes = await client.profile?.getProfilePicture?.(targetSender, 'preview').catch(() => null);
            const directUrl = ppRes?.url || (typeof ppRes === 'string' ? ppRes : null);
            if (directUrl) {
                const res = await axios.get(directUrl, { responseType: 'arraybuffer', timeout: 5000 });
                ppBuffer = Buffer.from(res.data);
            }
        } catch (e) {}
        const pngBuffer = await generateQcSticker(targetName, caption, ppBuffer, mediaBuffer);
        const webpSticker = await convertToWebp(pngBuffer, 'image');
        const exifBuffer = await addExif(webpSticker, "AMBATRON");
        await client.sendMessage(from, { sticker: exifBuffer }, { quoted: quotedMsg });
    } catch (err) {
        console.error('[QC Error]', err);
        await reportErrorToGroup(`Gagal membuat quote sticker: ${err.message}`, from, msg.key);
    }
}

async function handleToImgCommand(msg) {
    const from = msg.key.remoteJidAlt || msg.key.remoteJid;
    const quotedMsg = { ...msg, key: { ...msg.key, remoteJid: from } };
    const content = getRealMessage(msg.message);
    let stickerMessage = null;
    if (content?.stickerMessage) {
        stickerMessage = content.stickerMessage;
    } else if (content?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const q = getRealMessage(content.extendedTextMessage.contextInfo.quotedMessage);
        if (q?.stickerMessage) stickerMessage = q.stickerMessage;
    }
    if (!stickerMessage) {
        return client.sendMessage(from, { text: '⚠️ Balas/reply stiker dengan caption *.toimg* atau *.tovideo*' }, { quoted: quotedMsg });
    }
    try {
        const isAnimated = Boolean(stickerMessage.isAnimated);
        const buffer = await downloadMsgMedia({ message: content, key: msg.key }, 'sticker');
        const result = await convertWebpToMedia(buffer, isAnimated);
        if (result.isVideo) {
            await client.sendMessage(from, { video: result.buffer, caption: '✨ Berhasil dikonversi ke video!' }, { quoted: quotedMsg });
        } else {
            await client.sendMessage(from, { image: result.buffer, caption: '✨ Berhasil dikonversi ke gambar!' }, { quoted: quotedMsg });
        }
    } catch (err) {
        console.error('[ToImg Error]', err);
        await reportErrorToGroup(`Gagal convert stiker: ${err.message}`, from, msg.key);
    }
}

async function handleRvoCommandUniversal(msg) {
    const from = msg.key.remoteJid;
    if (!from) return;
    const quotedMsg = { ...msg, key: { ...msg.key, remoteJid: from } };
    const content = msg.message;
    let targetQuoted = content?.extendedTextMessage?.contextInfo?.quotedMessage;
    let targetViewOnce = null;
    if (targetQuoted) {
        targetViewOnce = targetQuoted.viewOnceMessage?.message || targetQuoted.viewOnceMessageV2?.message || targetQuoted.viewOnceMessageV2Extension?.message || targetQuoted;
    }
    if (!targetViewOnce) {
        return client.sendMessage(from, { text: '⚠️ Balas/reply pesan View-Once (Sekali Lihat) dengan caption *.rvo*' }, { quoted: quotedMsg });
    }
    try {
        const realMsg = getRealMessage(targetViewOnce);
        const imageMsg = realMsg?.imageMessage;
        const videoMsg = realMsg?.videoMessage;
        const audioMsg = realMsg?.audioMessage;
        if (imageMsg) {
            const buf = await downloadMsgMedia({ message: targetViewOnce, key: msg.key }, 'image');
            await client.sendMessage(from, { image: buf, mimetype: imageMsg.mimetype || 'image/jpeg', caption: imageMsg.caption || '🔓 *[View-Once Unlocked]*' }, { quoted: quotedMsg });
        } else if (videoMsg) {
            const buf = await downloadMsgMedia({ message: targetViewOnce, key: msg.key }, 'video');
            await client.sendMessage(from, { video: buf, mimetype: videoMsg.mimetype || 'video/mp4', caption: videoMsg.caption || '🔓 *[View-Once Unlocked]*' }, { quoted: quotedMsg });
        } else if (audioMsg) {
            const buf = await downloadMsgMedia({ message: targetViewOnce, key: msg.key }, 'audio');
            await client.sendMessage(from, { audio: buf, mimetype: audioMsg.mimetype || 'audio/mp4', ptt: audioMsg.ptt || false }, { quoted: quotedMsg });
        } else {
            await client.sendMessage(from, { text: '⚠️ Media view-once tidak ditemukan pada pesan yang dibalas.' }, { quoted: quotedMsg });
        }
    } catch (err) {
        console.error('[RVO Error]', err);
        await reportErrorToGroup(`Gagal membuka view-once: ${err.message}`, from, msg.key);
    }
}

async function handleHdImageCommand(msg, scaleParam) {
    const from = msg.key.remoteJidAlt || msg.key.remoteJid;
    const messageContent = getRealMessage(msg.message);
    const quotedMsg = { ...msg, key: { ...msg.key, remoteJid: from } };
    let mediaMessage = null;
    if (messageContent?.imageMessage) {
        mediaMessage = messageContent.imageMessage;
    } else if (messageContent?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = getRealMessage(messageContent.extendedTextMessage.contextInfo.quotedMessage);
        if (quoted?.imageMessage) mediaMessage = quoted.imageMessage;
    }
    if (!mediaMessage) {
        return client.sendMessage(from, { text: 'Reply atau kirim gambar dengan caption *.hd*' }, { quoted: quotedMsg });
    }
    let scale = scaleParam === '4' ? '4' : '2';
    try {
        const buffer = await downloadMsgMedia(msg, 'image');
        const b64 = buffer.toString('base64');
        const mimeType = mediaMessage.mimetype || 'image/jpeg';
        const res = await axios.post('https://api.jhx.my.id/hd-image', { b64, ct: mimeType, scale }, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 });
        if (res.data?.Status && res.data?.data?.url) {
            await client.sendMessage(from, { document: { url: res.data.data.url }, mimetype: 'image/png', fileName: `HD_Image_x${scale}.png`, caption: `✨ Hasil Upscale HD x${scale} selesai!` }, { quoted: quotedMsg });
        } else {
            await client.sendMessage(from, { text: `❌ Gagal memperbesar gambar: ${res.data?.error || 'Respon API tidak valid'}` }, { quoted: quotedMsg });
        }
    } catch (err) {
        console.error("[HD-Image] Error:", err.message);
        await client.sendMessage(from, { text: `❌ Gagal memproses gambar HD: ${err.message}` }, { quoted: quotedMsg });
    }
}

async function handleMetaCommand(msg, action) {
    const from = msg.key.remoteJidAlt || msg.key.remoteJid;
    const quotedMsg = { ...msg, key: { ...msg.key, remoteJid: from } };
    if (!from.endsWith('@g.us')) {
        return client.sendMessage(from, { text: '❌ Perintah ini hanya dapat digunakan di dalam grup!' }, { quoted: quotedMsg });
    }
    try {
        if (action === 'remove') {
            await client.group.removeParticipants(from, ["867051314767696@bot"]);
        } else if (action === 'add') {
            await client.group.addParticipants(from, ["867051314767696@bot"]);
        }
        await client.sendMessage(from, { text: `💻 *Meta Action (${action}) Result:* Success` }, { quoted: quotedMsg });
    } catch (err) {
        console.error(`[Meta Action] Error:`, err.message);
        await client.sendMessage(from, { text: `❌ Gagal memproses aksi ${action}: ${err.message}` }, { quoted: quotedMsg });
    }
}

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

const cleanUrl = (url, base) => {
    try { let s = String(url || "").trim().replace(/\\%/g, "%").replace(/&amp;/g, "&"); return new URL(s, base).toString(); } catch { return null; }
};

const uniq = arr => { const seen = new Set(); return arr.filter(x => { if (!x?.url || seen.has(x.url)) return false; seen.add(x.url); return true; }); };

async function resolveTikTokUrl(url) {
    try { const res = await axios.get(url, { maxRedirects: 10, validateStatus: () => true, headers: { "user-agent": UA } }); return res.request?.res?.responseUrl || url; } catch { return url; }
}

function getVideoId(url) {
    const id = String(url).match(/\/video\/(\d+)/)?.[1] || String(url).match(/item_id=(\d+)/)?.[1] || String(url).match(/(\d{15,})/)?.[1];
    if (!id) throw new Error("ID video TikTok tidak ditemukan");
    return id;
}

function parseState(html) {
    const json = html.match(/<script[^>]*id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (!json) throw new Error("Data TikTok tidak ditemukan");
    const state = JSON.parse(json);
    const data = Object.values(state?.source?.data || {}).find(v => v?.videoData)?.videoData;
    if (!data?.itemInfos) throw new Error("Video TikTok tidak ditemukan");
    return data;
}

async function forwardMessageWithoutTag(toJid, msg) {
    const content = getRealMessage(msg.message);
    if (!content) return;
    if (content.conversation || content.extendedTextMessage?.text) {
        await client.sendMessage(toJid, { text: content.conversation || content.extendedTextMessage.text });
        return;
    }
    let mediaType = null;
    if (content.imageMessage) mediaType = 'image';
    else if (content.videoMessage) mediaType = 'video';
    else if (content.audioMessage) mediaType = 'audio';
    else if (content.stickerMessage) mediaType = 'sticker';
    else if (content.documentMessage) mediaType = 'document';
    if (mediaType) {
        try {
            const buf = await downloadMsgMedia(msg, mediaType);
            const mediaMsg = content[`${mediaType}Message`];
            if (mediaType === 'image') await client.sendMessage(toJid, { image: buf, caption: mediaMsg?.caption });
            else if (mediaType === 'video') await client.sendMessage(toJid, { video: buf, caption: mediaMsg?.caption });
            else if (mediaType === 'audio') await client.sendMessage(toJid, { audio: buf, mimetype: mediaMsg?.mimetype, ptt: mediaMsg?.ptt });
            else if (mediaType === 'sticker') await client.sendMessage(toJid, { sticker: buf });
            else if (mediaType === 'document') await client.sendMessage(toJid, { document: buf, mimetype: mediaMsg?.mimetype, fileName: mediaMsg?.fileName, caption: mediaMsg?.caption });
        } catch (e) { console.error('Forward media error:', e); }
    }
}

async function handleRvoByQuoted(quotedMsg, targetJid, originalMsgKey) {
    let mediaType = null;
    if (quotedMsg.imageMessage) mediaType = 'image';
    else if (quotedMsg.videoMessage) mediaType = 'video';
    else if (quotedMsg.audioMessage) mediaType = 'audio';
    if (!mediaType) return;
    try {
        const buf = await downloadMsgMedia({ message: quotedMsg, key: originalMsgKey }, mediaType);
        const destinationJid = `${global.owner?.[0] || ''}@s.whatsapp.net`;
        const senderInfo = originalMsgKey.participant || originalMsgKey.remoteJid || 'Unknown';
        await client.sendMessage(destinationJid, { text: `📸 *Pesan Sekali Lihat (React 😢) dari ${senderInfo.split('@')[0]}*` });
        if (mediaType === 'image') await client.sendMessage(destinationJid, { image: buf, caption: quotedMsg.imageMessage?.caption || "" });
        else if (mediaType === 'video') await client.sendMessage(destinationJid, { video: buf, caption: quotedMsg.videoMessage?.caption || "" });
        else if (mediaType === 'audio') await client.sendMessage(destinationJid, { audio: buf, mimetype: "audio/mpeg", ptt: true });
    } catch (err) { console.error("RVO React Error:", err); }
}

async function connectToWhatsApp() {
    const authDir = process.env.SESSION_DIR ? String(process.env.SESSION_DIR).trim() : 'session_auth';
    console.log(`[WA-BOT-CONNECT] Starting with zapo, sessionDir: ${authDir}`);

    const sqlitePath = path.join('db', `zapo-${authDir}.sqlite`);
    const store = createStore({
        backends: {
            sqlite: createSqliteStore({ path: sqlitePath, driver: 'auto' })
        },
        providers: {
            auth: 'sqlite', signal: 'sqlite', senderKey: 'sqlite', appState: 'sqlite',
            messages: 'sqlite', threads: 'sqlite', contacts: 'sqlite', privacyToken: 'sqlite',
            preKey: 'sqlite', session: 'sqlite', identity: 'sqlite',
            retry: 'sqlite', groupMetadata: 'sqlite', deviceList: 'sqlite', messageSecret: 'sqlite'
        }
    });

    const pinoLogger = await createPinoLogger({ level: 'silent' });

    const mediaProcessor = createMediaProcessor();

    client = new WaClient({
        store,
        sessionId: authDir,
        connectTimeoutMs: 30000,
        nodeQueryTimeoutMs: 30000,
        deviceBrowser: 'Safari',
        deviceOsDisplayName: 'macOS',
        history: { enabled: false },
        media: { processor: mediaProcessor }
    }, pinoLogger);

    client.on('auth_qr', ({ qr }) => {
        console.log(`[QR] Scan QR code:`);
        qrcode.generate(qr, { small: true });
    });

    client.on('auth_pairing_code', ({ code }) => {
        const fmt = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('\n====================================================');
        console.log(`  KODE PAIRING BOT: [  ${fmt}  ]`);
        console.log('====================================================\n');
    });

    client.on('auth_paired', ({ credentials }) => {
        logger.success('PAIR', `Berhasil terhubung ke akun! JID: ${credentials?.meJid}`);
    });

    client.on('connection', async (event) => {
        if (event.status === 'open') {
            logger.success('CONNECT', 'Koneksi WhatsApp berhasil tersambung!');
            const myJidRaw = client.auth?.credentials?.pnJid || client.auth?.credentials?.meJid || `${process.env.PHONE_NUMBER || '628567611130'}@s.whatsapp.net`;
            const cleanMyNumber = myJidRaw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            client.user = {
                id: `${cleanMyNumber}@s.whatsapp.net`,
                lid: client.auth?.credentials?.meLid || '',
                name: client.auth?.credentials?.meDisplayName || 'AMBATRON'
            };

            // Helper to resolve buffer from string/url/buffer
            const resolveMediaBuffer = async (mediaInput) => {
                if (!mediaInput) return null;
                if (Buffer.isBuffer(mediaInput) || mediaInput instanceof Uint8Array) return mediaInput;
                if (typeof mediaInput === 'object' && mediaInput.url) {
                    const res = await axios.get(mediaInput.url, { responseType: 'arraybuffer', timeout: 30000 });
                    return Buffer.from(res.data);
                }
                if (typeof mediaInput === 'string') {
                    if (mediaInput.startsWith('http://') || mediaInput.startsWith('https://')) {
                        const res = await axios.get(mediaInput, { responseType: 'arraybuffer', timeout: 30000 });
                        return Buffer.from(res.data);
                    }
                    if (fs.existsSync(mediaInput)) {
                        return fs.readFileSync(mediaInput);
                    }
                }
                return mediaInput;
            };

            // Baileys-compatible sendMessage wrapper for Zapo
            client.sendMessage = async (jid, content, options = {}) => {
                const quoted = options.quoted || content.contextInfo?.quoted;
                const sendOpts = quoted ? { quote: quoted } : {};

                // Support mentions forwarding
                const rawMentions = options.mentions || content.mentions || content.contextInfo?.mentionedJid || [];
                const mentions = Array.isArray(rawMentions) ? rawMentions.filter(Boolean) : [];
                if (mentions.length > 0) {
                    sendOpts.mentions = mentions;
                }

                let res = null;

                // Reaction
                if (content.reactionMessage) {
                    return client.message.send(jid, { type: 'reaction', emoji: content.reactionMessage.text, target: content.reactionMessage.key });
                }

                // Revoke / Delete Message
                if (content.delete) {
                    const d = content.delete;
                    const targetId = d?.id || (typeof d === 'string' ? d : '');
                    if (targetId) {
                        return client.message.send(jid, {
                            type: 'revoke',
                            target: {
                                id: targetId,
                                remoteJid: d?.remoteJid || jid,
                                fromMe: d?.fromMe ?? true,
                                participant: d?.participant
                            }
                        }, sendOpts).catch(() => {});
                    }
                }

                // Sticker from buffer
                if (content.sticker) {
                    const buf = await resolveMediaBuffer(content.sticker);
                    const payload = { type: 'sticker', media: buf };
                    res = await client.message.send(jid, payload, sendOpts);
                }
                // Image from buffer or URL
                else if (content.image) {
                    const buf = await resolveMediaBuffer(content.image);
                    const payload = {
                        type: 'image',
                        media: buf,
                        caption: content.caption || '',
                        mimetype: content.mimetype || 'image/jpeg'
                    };
                    res = await client.message.send(jid, payload, sendOpts);
                }
                // Video from buffer or URL
                else if (content.video) {
                    const buf = await resolveMediaBuffer(content.video);
                    const payload = {
                        type: 'video',
                        media: buf,
                        caption: content.caption || '',
                        mimetype: content.mimetype || 'video/mp4'
                    };
                    res = await client.message.send(jid, payload, sendOpts);
                }
                // Audio
                else if (content.audio) {
                    const buf = await resolveMediaBuffer(content.audio);
                    const payload = {
                        type: 'audio',
                        media: buf,
                        mimetype: content.mimetype || 'audio/mp4',
                        ptt: content.ptt || false
                    };
                    res = await client.message.send(jid, payload, sendOpts);
                }
                // Document
                else if (content.document) {
                    const buf = await resolveMediaBuffer(content.document);
                    const payload = {
                        type: 'document',
                        media: buf,
                        mimetype: content.mimetype || 'application/octet-stream',
                        fileName: content.fileName || 'file',
                        caption: content.caption || ''
                    };
                    res = await client.message.send(jid, payload, sendOpts);
                }
                // Text (plain string or { text: '...' })
                else if (typeof content === 'string' || content.text || content.conversation || content.extendedTextMessage?.text) {
                    const text = typeof content === 'string' ? content : (content.text || content.conversation || content.extendedTextMessage?.text || '');
                    const payload = { type: 'text', text };
                    if (mentions.length > 0) {
                        payload.contextInfo = payload.contextInfo || {};
                        payload.contextInfo.mentionedJid = mentions;
                    }
                    res = await client.message.send(jid, payload, sendOpts);
                }
                // Interactive / Native Flow / Rich message / Raw passthrough
                else if (content && typeof content === 'object') {
                    res = await client.message.send(jid, content, sendOpts);
                } else {
                    console.warn('[sendMessage] Unhandled content type:', content);
                }

                if (res?.id) {
                    saveToStore({
                        key: { remoteJid: jid, id: res.id, fromMe: true },
                        message: typeof content === 'string' ? { conversation: content } : content
                    });
                }
                return res;
            };
            await loadPlugins();
            startPluginWatcher();
            startBannedExpiryScheduler(client);
            setTimeout(() => {
                restoreClonedSessions().catch(console.error);
                try { restoreWwGames(client); } catch (e) { console.error('[Werewolf Restore]', e.message); }
            }, 3000);
        } else if (event.status === 'close') {
            logger.warn('CONNECT', `Koneksi terputus: ${event.reason || 'Closed'}`);
            const shouldReconnect = event.reason !== 'loggedOut' && event.reason !== 'loggedOutElsewhere';
            if (shouldReconnect) {
                setTimeout(() => {
                    if (client) {
                        client.connect().catch((e) => console.error('[Reconnect Error]', e.message || e));
                    }
                }, 5000);
            }
        }
    });

    client.on('contacts.update', (updates) => {
        for (const update of updates) {
            if (update.id && (update.name || update.notify || update.verifiedName)) {
                chatNameCache.set(update.id, update.name || update.notify || update.verifiedName);
            }
        }
    });

    // ─── ANTI-CALL HANDLER ──────────────────────────────────────────────────
    client.on('call', async (callEvent) => {
        const botSettings = getBotSettings();
        if (!botSettings.antiCall) return;

        const callerJid = callEvent.callerPnJid || callEvent.callCreatorJid || callEvent.from || '';
        if (!callerJid || (global.isOwner && global.isOwner(callerJid))) return; // Jangan blokir owner

        // 1 panggilan memancarkan banyak event (offer/transport/terminate) →
        // gate ini hanya memproses OFFER pertama & membatasi pesan per caller
        const gate = evaluateAntiCall(callEvent, callerJid);
        if (!gate.handle) return;

        logger.warn('Anti-Call', `Menolak panggilan dari: ${callerJid} (tipe: ${callEvent.type || 'unknown'}, id: ${callEvent.callId || '-'})`);
        try {
            // Tolak panggilan via lowLevelCoordinator jika ada
            if (client.lowLevel?.sendNode && callEvent.callId) {
                await client.lowLevel.sendNode({
                    tag: 'call',
                    attrs: {
                        to: callerJid,
                        id: callEvent.callId
                    },
                    content: [{
                        tag: 'reject',
                        attrs: {
                            'call-id': callEvent.callId,
                            'call-creator': callEvent.callCreatorJid || callerJid,
                            count: '0'
                        }
                    }]
                }).catch(() => {});
            }

            // Jika panggilan dari grup (group call), cukup reject saja tanpa ban & tanpa pesan
            const isGroupCall = (callEvent.chatId || callEvent.from || '').endsWith('@g.us');
            if (!isGroupCall) {
                const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
                const now = Date.now();

                if (!global.db.data.users) global.db.data.users = {};
                const existingUser = global.db.data.users[callerJid];
                
                // Akumulatif: jika sudah banned dan masih ada sisa waktu, tambahkan 30 hari dari expiry sebelumnya
                const currentExpiry = (existingUser?.banned && existingUser?.bannedExpiry && existingUser.bannedExpiry > now)
                    ? existingUser.bannedExpiry
                    : now;
                const expiryTime = currentExpiry + thirtyDaysMs;
                const wasAlreadyBanned = Boolean(existingUser?.banned && existingUser?.bannedExpiry && existingUser.bannedExpiry > now);

                if (!existingUser) {
                    global.db.data.users[callerJid] = {
                        name: callerJid.split('@')[0],
                        exp: 0,
                        level: 1,
                        banned: true,
                        bannedExpiry: expiryTime,
                        bannedReason: 'Call Bot'
                    };
                } else {
                    existingUser.banned = true;
                    existingUser.bannedExpiry = expiryTime;
                    existingUser.bannedReason = 'Call Bot';
                }
                global.db.scheduleSave();

                // Kirim pesan peringatan (maksimal 1x per 5 menit untuk caller yang sama)
                if (gate.notify) {
                    const expDateStr = new Date(expiryTime).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                    });
                    const sisaHariTotal = Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000));
                    const tambahMsg = wasAlreadyBanned
                        ? `⚠️ Anda menelepon lagi saat status banned masih aktif! Hukuman banned ditambah *+30 Hari* lagi (Total sisa: *${sisaHariTotal} Hari* hingga *${expDateStr}*).`
                        : `Akun Anda otomatis di-banned selama *30 Hari* (hingga *${expDateStr}*).`;

                    await client.sendMessage(callerJid, {
                        text: `⚠️ *ANTI-CALL AKTIF!*\n\nMaaf, bot tidak menerima panggilan telepon ataupun video.\n${tambahMsg}\n\nSetelah masa banned selesai, akun Anda akan otomatis di-unban oleh sistem.`
                    }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Anti-Call Error]', err.message);
        }
    });

    // ─── GROUP MEMBERSHIP CHANGE LISTENER (WELCOME / BYE / PROMOTE / DEMOTE) ───
    client.on('group', async (event) => {
        try {
            const botSettings = getBotSettings();
            if (!botSettings.publicMode || !botSettings.groupMode) return;

            if (!event.groupJid || !event.participants?.length) return;
            const chatJid = event.groupJid;
            const chatData = global.db?.data?.chats?.[chatJid];

            let groupMeta = null;
            try {
                groupMeta = await client.group.queryGroupMetadata(chatJid);
            } catch (_) {}

            const groupSubject = groupMeta?.subject || chatData?.subject || 'Grup WhatsApp';
            const groupDesc = groupMeta?.desc || groupMeta?.description || chatData?.desc || '-';

            // 1. ACTION: ADD (GABUNG / DITAMBAHKAN)
            if (event.action === 'add') {
                if (chatData?.welcome === false) return;

                const newMembers = [];
                for (const p of event.participants) {
                    const userJid = typeof p === 'string' ? p : (p.jid || p.id);
                    if (!userJid) continue;
                    if (!event.simulate && userJid === client.user?.id) continue;
                    newMembers.push(userJid);
                }

                if (newMembers.length === 0) return;

                const userTags = newMembers.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ');
                let welcomeTemplate = chatData?.sWelcome || `Hai kak @user 👋\nSelamat datang di *@subject*!\nSemoga betah dan patuhi peraturan grup ya 🤝\n\n*Deskripsi Grup:*\n@desc`;

                const welcomeText = welcomeTemplate
                    .replace(/@user/g, userTags)
                    .replace(/@subject/g, groupSubject)
                    .replace(/@desc/g, groupDesc);

                await client.sendMessage(chatJid, {
                    text: welcomeText,
                    mentions: newMembers
                }).catch(() => {});
                return;
            }

            // 2. ACTION: REMOVE / PROMOTE / DEMOTE
            for (const p of event.participants) {
                const userJid = typeof p === 'string' ? p : (p.jid || p.id);
                if (!userJid) continue;
                if (!event.simulate && userJid === client.user?.id) continue;
                const userNum = userJid.split('@')[0].split(':')[0];

                if (event.action === 'remove') {
                    if (chatData?.leave === false) continue;
                    let byeTemplate = chatData?.sBye || `Selamat tinggal kak @user 👋\nSemoga harimu menyenangkan di luar sana!`;
                    const byeText = byeTemplate
                        .replace(/@user/g, `@${userNum}`)
                        .replace(/@subject/g, groupSubject)
                        .replace(/@desc/g, groupDesc);

                    await client.sendMessage(chatJid, {
                        text: byeText,
                        mentions: [userJid]
                    }).catch(() => {});
                } else if (event.action === 'promote') {
                    if (chatData?.detect === false) continue;
                    let promoteTemplate = chatData?.sPromote || `🎉 *Promote Terdeteksi*\nSelamat kepada @user yang telah diangkat menjadi Admin grup *@subject*! 🫡`;
                    const promoteText = promoteTemplate
                        .replace(/@user/g, `@${userNum}`)
                        .replace(/@subject/g, groupSubject)
                        .replace(/@desc/g, groupDesc);

                    await client.sendMessage(chatJid, {
                        text: promoteText,
                        mentions: [userJid]
                    }).catch(() => {});
                } else if (event.action === 'demote') {
                    if (chatData?.detect === false) continue;
                    let demoteTemplate = chatData?.sDemote || `📉 *Demote Terdeteksi*\nJabatan admin @user telah diturunkan menjadi Member biasa di *@subject*.`;
                    const demoteText = demoteTemplate
                        .replace(/@user/g, `@${userNum}`)
                        .replace(/@subject/g, groupSubject)
                        .replace(/@desc/g, groupDesc);

                    await client.sendMessage(chatJid, {
                        text: demoteText,
                        mentions: [userJid]
                    }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[Group Event Error]', err.message);
        }
    });

    client.on('message', async (event) => {
        const rawMsg = event.raw || event;
        if (!rawMsg.message) return;

        let m;
        try {
            m = await smsg(client, event);
        } catch (e) {
            console.error('[smsg error]', e);
            m = rawMsg;
        }

        const mType = m.mtype || getMessageType(rawMsg);
        const mText = m.text || '';
        const text = mText;
        const cleanText = m.cleanText || text.trim();

        const sender = m.sender || rawMsg.key.participant || rawMsg.key.remoteJid || '';
        const senderName = m.name || (rawMsg.key.fromMe ? 'Me (Bot)' : (rawMsg.pushName || sender.split('@')[0] || 'Unknown'));

        // Nama chat: cache kontak → nama grup (ter-cache) → LID→PN→kontak → pushName → nomor
        let chatTargetName = chatNameCache.get(m.chat) || '';
        if (!chatTargetName && m.isGroup) {
            chatTargetName = await getGroupName(client, m.chat);
        }
        if (!chatTargetName && !m.isGroup) {
            const pn = m.chat?.endsWith('@lid') ? resolvePhoneNumberFromLid(m.chat) : (m.chat?.split('@')[0] || '');
            chatTargetName = (pn && chatNameCache.get(pn + '@s.whatsapp.net')) || m.name || m.pushName || pn;
        }
        // pushName kontak lain (incoming) dijadikan nama chat DM untuk log berikutnya
        if (!m.isGroup && !rawMsg.key.fromMe && (m.name || m.pushName)) {
            chatNameCache.set(m.chat, m.name || m.pushName);
        }
        if (!chatTargetName) chatTargetName = m.chat?.split('@')[0] || '';

        printMessageLog(m, {
            mtype: mType,
            senderName,
            chatName: chatTargetName
        });

        // ─── TAMPILKAN PREVIEW MEDIA (FOTO/STIKER) SECARA DEFAULT ────────────
        const isMediaImg = ['imageMessage', 'stickerMessage', 'videoMessage'].includes(mType) ||
            Boolean(rawMsg.message?.imageMessage || rawMsg.message?.stickerMessage || rawMsg.message?.videoMessage);

        if (isMediaImg) {
            (async () => {
                try {
                    let buf = null;
                    if (typeof m.download === 'function') {
                        buf = await m.download().catch(() => null);
                    }
                    if (!buf && m.quoted && typeof m.quoted.download === 'function') {
                        buf = await m.quoted.download().catch(() => null);
                    }
                    if (!buf) {
                        buf = await downloadMedia(rawMsg, client).catch(() => null);
                    }
                    if (buf && buf.length > 0) {
                        const rendered = await renderTerminalImage(buf);
                        if (rendered) process.stdout.write(rendered + '\n');
                    }
                } catch (_) {}
            })();
        }

        try {
            const logFileName = path.join('db', `chat-${AUTH_DIR_NAME}.log`);
            fs.appendFileSync(logFileName, `[${new Date().toISOString()}] [${mType}] From: (${senderName} <${sender}>) | Chat: (${chatTargetName}) | Msg: ${mText}\n`, 'utf8');
        } catch (e) {}

        const myJid = client.user?.id || '';
        const myNumber = myJid.split('@')[0].split(':')[0];
        const myLid = client.user?.lid || '';
        const senderNumber = sender.split('@')[0].split(':')[0];

        // ─── Rich Reply (Tombol/List native flow) Intercept ───────────────────
        if (m.richReply) {
            const richHandler = getRichHandler(m.richReply.id);
            if (richHandler) {
                try {
                    await richHandler(m, m.richReply);
                } catch (err) {
                    console.error('[RichReply Handler Error]', err);
                }
                return;
            }
        }

        // ─── Werewolf: cegah pemain yang sudah gugur chat di grup ─────────────
        try {
            if (await handleDeadPlayerChat(client, m)) return;
        } catch (e) {}

        const isCommand = Boolean(m.richReply) || cleanText.startsWith('.') || cleanText.startsWith('!') || cleanText.startsWith('/') || cleanText.startsWith('#') || cleanText.startsWith('$') || cleanText.startsWith('>') || /https?:\/\/[^\s]+/i.test(cleanText);

        // Hanya skip pesan bot sendiri jika BUKAN command / link dari Owner
        if (!isCommand && (sender === myJid || sender === myLid || (myNumber && senderNumber === myNumber))) {
            return;
        }

        if (rawMsg.message?.reactionMessage) {
            const reaction = rawMsg.message.reactionMessage;
            if (reaction.text === '😢') {
                const targetId = reaction.key?.id;
                const originalMsg = getFromStore(targetId);
                if (originalMsg) {
                    const originalSender = originalMsg.key.participant || originalMsg.key.remoteJid || '';
                    if (checkIfViewOnce(originalMsg.message) && isTargetUser(originalSender)) {
                        await handleRvoByQuoted(getRealMessage(originalMsg.message), rawMsg.key.remoteJid, originalMsg.key);
                    }
                }
            }
            return;
        }

        if (rawMsg.key?.remoteJid === 'status@broadcast') {
            if (getAutoReadStatusSetting()) {
                try {
                    const statusSender = rawMsg.key.participant || sender;
                    await client.message.sendReceipt('status@broadcast', [rawMsg.key.id], {
                        participant: statusSender,
                        type: 'read'
                    });
                    logger.info('Auto-Read Status', `Tandai status dibaca: ${statusSender} (${rawMsg.key.id})`);
                } catch (e) {
                    console.error('[Auto-Read Status Error]', e.message || e);
                }
            }
            return;
        }

        const protocolMsg = rawMsg.message?.protocolMessage;
        if (protocolMsg && (protocolMsg.type === 3 || protocolMsg.type === 'REVOKE' || protocolMsg.type === 4)) {
            const targetId = protocolMsg.key?.id;
            const originalMsg = getFromStore(targetId);
            if (originalMsg && isTargetUser(originalMsg.key.participant || originalMsg.key.remoteJid || '')) {
                try {
                    await client.sendMessage(`${global.owner?.[0] || ''}@s.whatsapp.net`, { text: `⚠️ *Pesan Ditarik*` });
                    await forwardMessageWithoutTag(`${global.owner?.[0] || ''}@s.whatsapp.net`, originalMsg);
                } catch (e) {}
            }
            return;
        }

        saveToStore(rawMsg);
        cleanOldCache();

        let remoteJid = rawMsg.key.remoteJid;

        if (rawMsg.key.fromMe && !remoteJid.endsWith('@g.us')) {
            remoteJid = myJid ? myJid.split(':')[0] + '@s.whatsapp.net' : remoteJid;
        }

        const from = m.chat || rawMsg.key.remoteJidAlt || rawMsg.key.remoteJid;
        const quotedMsg = { ...rawMsg, key: { ...rawMsg.key, remoteJid: from } };

        const senderJid = m.sender || rawMsg.key.participant || rawMsg.key.remoteJid || '';
        const realPhone = m.realPhone || resolvePhoneNumberFromMsg(rawMsg, client) || senderJid.split('@')[0].split(':')[0];
        const isOwner = m.isOwner;

        // ─── PENGATURAN MODE BOT (PUBLIC / SELF & GROUP ACCESS) ────────────────
        const botSettings = getBotSettings();
        // Auto-Read Message (Centang Biru) jika fitur autoReadMessage aktif
        if (botSettings.autoReadMessage && !rawMsg.key.fromMe && rawMsg.key.id && m.chat !== 'status@broadcast') {
            try {
                const participant = m.isGroup ? (rawMsg.key.participant || sender) : undefined;
                await client.message.sendReceipt(m.chat, [rawMsg.key.id], {
                    participant,
                    type: 'read'
                }).catch(() => {});
            } catch (e) {}
        }

        if (!isOwner) {
            // Jika mode self (publicMode = false), abaikan semua pengguna lain
            if (!botSettings.publicMode) return;

            // Jika mode grup nonaktif (groupMode = false), abaikan perintah di dalam grup
            if (m.isGroup && !botSettings.groupMode) return;
        }

        const reply = m.reply;

        const pluginHandled = await handlePluginMessage(m, {
            client,
            from,
            quotedMsg,
            cleanText,
            senderJid,
            realPhone,
            isOwner,
            reply,
            chatName: chatTargetName,
            downloadMsgMedia,
            convertToWebp,
            addExif
        });
        if (pluginHandled) return;

        // ─── AUTO DOWNLOADER SOSMED (DIPINDAH KE PLUGIN DOWNLOADER) ───────────
    });

    const rawPhone = (process.env.PHONE_NUMBER || process.env.SESSION_DIR || '').replace(/[^0-9]/g, '');

    let hasStoredSession = false;
    try {
        const checkDb = new (await import('better-sqlite3')).default(sqlitePath, { readonly: true });
        const row = checkDb.prepare("SELECT me_jid FROM auth_credentials WHERE session_id = ?").get(authDir);
        hasStoredSession = Boolean(row?.me_jid);
        checkDb.close();
    } catch(e) {}

    const connectPromise = client.connect();

    if (!hasStoredSession && rawPhone && rawPhone.length >= 10) {
        try {
            console.log(`[Pairing] Waiting for auth_qr... (phone: ${rawPhone})`);
            const pairingReady = new Promise((resolve) => {
                const onQr = () => { cleanup(); resolve(true); };
                const onTimeout = () => { cleanup(); resolve(false); };
                const cleanup = () => {
                    client.removeListener('auth_qr', onQr);
                    clearTimeout(timer);
                };
                client.once('auth_qr', onQr);
                const timer = setTimeout(onTimeout, 10000);
            });
            const ready = await pairingReady;
            if (ready) {
                const code = await Promise.race([
                    client.auth.requestPairingCode(rawPhone),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('requestPairingCode timeout')), 20000))
                ]);
                const formatted = code.match(/.{1,4}/g)?.join('-') || code;
                console.log(`[Pairing] Code for ${rawPhone}: ${code} (${formatted})`);
            } else {
                console.log('[Pairing] auth_qr not received within 10s');
            }
        } catch (err) {
            console.error('[Auto Pairing Error]', err.message);
        }
    } else {
        console.log(`[Pairing] Skipping pairing (hasStoredSession=${hasStoredSession})`);
    }

    await connectPromise;
}


connectToWhatsApp();
