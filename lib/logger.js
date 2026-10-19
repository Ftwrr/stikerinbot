/**
 * ANSI Color Codes (Zero-dependency Terminal Styling)
 */
export const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    // Bright colors
    gray: '\x1b[90m',
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',

    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
};

const c = colors;

/**
 * Format timestamp: [HH:mm:ss]
 */
function getTimestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${c.gray}[${h}:${m}:${s}]${c.reset}`;
}

/**
 * Format tipe pesan dengan warna khusus
 */
function formatMessageType(mType, fromMe) {
    if (fromMe) {
        return `${c.bgBlue}${c.brightWhite} ME (OUT) ${c.reset}`;
    }

    const typeUpper = String(mType || 'OTHER').toUpperCase().replace('MESSAGE', '');

    switch (typeUpper) {
        case 'CONVERSATION':
        case 'EXTENDEDTEXT':
        case 'TEXT':
            return `${c.bgGreen}${c.black} TEXT ${c.reset}`;
        case 'IMAGE':
            return `${c.bgMagenta}${c.brightWhite} IMAGE ${c.reset}`;
        case 'VIDEO':
            return `${c.bgRed}${c.brightWhite} VIDEO ${c.reset}`;
        case 'AUDIO':
            return `${c.bgYellow}${c.black} AUDIO ${c.reset}`;
        case 'STICKER':
            return `${c.bgCyan}${c.black} STICKER ${c.reset}`;
        case 'DOCUMENT':
            return `${c.bgBlack}${c.brightCyan} DOC ${c.reset}`;
        case 'REACTION':
            return `${c.bgBlack}${c.brightYellow} REACT ${c.reset}`;
        case 'PROTOCOL':
            return `${c.bgBlack}${c.gray} PROTOCOL ${c.reset}`;
        default:
            return `${c.bgBlack}${c.white} ${typeUpper} ${c.reset}`;
    }
}

/**
 * Cetak log pesan masuk/keluar bergaya estetik dan informatif (wabot-aq / games-wabot)
 * Menyertakan metadata verbositas: ID pesan, status Quoted, Mention, dan ukuran isi.
 */
export function printMessageLog(m, options = {}) {
    if (!m) return;

    const time = getTimestamp();
    const mType = m.mtype || options.mtype || 'Other';
    const fromMe = Boolean(m.key?.fromMe);
    const badge = formatMessageType(mType, fromMe);

    const senderName = m.name || m.pushName || options.senderName || 'Unknown';
    const senderNumber = m.realPhone || m.senderNumber || (m.sender ? m.sender.split('@')[0].split(':')[0] : '-');

    const isGroup = Boolean(m.isGroup);
    const chatName = options.chatName || (isGroup ? (m.chat ? m.chat.split('@')[0] : 'Group') : 'Private');
    const msgId = m.id || m.key?.id || '';
    const shortId = msgId ? `${c.dim}#${msgId.slice(0, 8)}${c.reset}` : '';

    // Metadata tambahan untuk debugging
    const metaTags = [];
    if (m.quoted) metaTags.push(`${c.brightMagenta}↱quoted${c.reset}`);
    if (m.mentionedJid && m.mentionedJid.length > 0) metaTags.push(`${c.cyan}@${m.mentionedJid.length}${c.reset}`);
    if (m.richReply) metaTags.push(`${c.brightYellow}⚡btn:${m.richReply.id || 'flow'}${c.reset}`);

    const metaStr = metaTags.length > 0 ? ` [${metaTags.join(' ')}]` : '';

    let contentPreview = m.cleanText || m.text || '';
    if (contentPreview) {
        contentPreview = contentPreview.replace(/\r?\n/g, ' ');
        if (contentPreview.length > 80) {
            contentPreview = contentPreview.slice(0, 77) + '...';
        }
    } else {
        contentPreview = `${c.gray}(media / non-teks)${c.reset}`;
    }

    // Format Sender: Nama (+Nomor)
    const senderTag = `${c.brightCyan}${senderName}${c.reset} ${c.gray}(+${senderNumber})${c.reset}`;

    // Format Lokasi Chat
    const locationTag = isGroup
        ? `${c.brightYellow}👥 [${chatName}]${c.reset}`
        : `${c.green}👤 [Private DM]${c.reset}`;

    // Tampilkan log rapi dan informatif
    console.log(`${time} ${badge} ${locationTag} ${senderTag}${metaStr} ${shortId}\n  ${c.gray}↳${c.reset} ${c.brightWhite}${contentPreview}${c.reset}`);
}

/**
 * Log eksekusi perintah plugin (Command Runner Verbose Logger)
 * Menampilkan durasi eksekusi dalam millidetik (ms), status, dan user pemanggil
 */
export function printCommandLog({ cmdName, sender, senderName, isGroup, chatName, durationMs, error = null }) {
    const time = getTimestamp();
    const statusBadge = error
        ? `${c.bgRed}${c.brightWhite} FAIL ${c.reset}`
        : `${c.bgGreen}${c.black} EXEC ${c.reset}`;

    const num = sender ? sender.split('@')[0].split(':')[0] : '-';
    const loc = isGroup ? `[${chatName || 'Group'}]` : `[DM]`;
    const durStr = `${c.brightYellow}${durationMs.toFixed(1)}ms${c.reset}`;

    if (error) {
        console.log(`${time} ${statusBadge} ${c.brightRed}.${cmdName}${c.reset} by ${c.cyan}${senderName || num}${c.reset} in ${c.dim}${loc}${c.reset} (${durStr})\n  ${c.red}❌ Error: ${error.message || error}${c.reset}`);
    } else {
        console.log(`${time} ${statusBadge} ${c.brightGreen}.${cmdName}${c.reset} by ${c.cyan}${senderName || num}${c.reset} in ${c.dim}${loc}${c.reset} (${durStr})`);
    }
}

/**
 * Logger untuk koneksi dan lifecycle bot
 */
export const logger = {
    info: (tag, msg) => {
        console.log(`${getTimestamp()} ${c.brightCyan}[INFO]${c.reset} ${c.bold}${tag}${c.reset} : ${msg}`);
    },
    success: (tag, msg) => {
        console.log(`${getTimestamp()} ${c.brightGreen}[SUCCESS]${c.reset} ${c.bold}${tag}${c.reset} : ${msg}`);
    },
    warn: (tag, msg) => {
        console.log(`${getTimestamp()} ${c.brightYellow}[WARN]${c.reset} ${c.bold}${tag}${c.reset} : ${msg}`);
    },
    error: (tag, msg) => {
        console.log(`${getTimestamp()} ${c.brightRed}[ERROR]${c.reset} ${c.bold}${tag}${c.reset} : ${msg}`);
    },
    debug: (tag, msg) => {
        console.log(`${getTimestamp()} ${c.gray}[DEBUG]${c.reset} ${c.dim}${tag} : ${msg}${c.reset}`);
    }
};

export default {
    colors,
    printMessageLog,
    printCommandLog,
    logger
};
