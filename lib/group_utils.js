/**
 * group_utils.js — Helper grup: cache metadata, resolusi admin & target.
 * Metadata grup di-cache singkat agar tidak query IQ tiap pesan.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map();

export const numFromJid = (jid) =>
    String(jid || '').replace(/@.+/, '').split(':')[0].replace(/[^0-9]/g, '');

export function invalidateGroupCache(jid) {
    if (jid) cache.delete(jid);
    else cache.clear();
}

export async function getGroupMetadata(client, jid, force = false) {
    const now = Date.now();
    const hit = cache.get(jid);
    if (!force && hit && now - hit.at < CACHE_TTL_MS) return hit.meta;

    const meta = await client.group.queryGroupMetadata(jid);
    cache.set(jid, { at: now, meta });
    return meta;
}

export function findParticipant(meta, sender, realPhone, senderNumber) {
    const parts = meta?.participants || [];
    const senderStr = String(sender || '');
    const pn = realPhone || senderNumber || numFromJid(senderStr);
    const lidNum = senderStr.includes('@lid') ? numFromJid(senderStr) : '';

    return parts.find((p) => {
        const pJid = p.jid || p.id || '';
        const pLid = p.lid || '';
        const pNum = numFromJid(pJid);
        const pLidNum = pLid ? numFromJid(pLid) : '';
        const pPhone = (p.phoneNumber || '').replace(/[^0-9]/g, '');

        return (
            (pn && (pNum === pn || pPhone === pn || pLidNum === pn)) ||
            (lidNum && (pLidNum === lidNum || pNum === lidNum)) ||
            pJid === senderStr
        );
    });
}

export const isAdminParticipant = (p) =>
    Boolean(p?.isAdmin || p?.isSuperAdmin || p?.admin === 'admin' || p?.admin === 'superadmin');

/**
 * Resolusi status admin pengirim & bot dalam satu query metadata (ter-cache).
 */
export async function resolveGroupAccess(client, m, force = false) {
    const meta = await getGroupMetadata(client, m.chat, force);
    const meJid = client?.user?.id || client?.user?.lid || client?._botJid || '';
    const me = findParticipant(meta, meJid, numFromJid(meJid), '');
    const user = findParticipant(meta, m.sender, m.realPhone, m.senderNumber);

    return {
        meta,
        me,
        user,
        isAdmin: isAdminParticipant(user),
        isBotAdmin: isAdminParticipant(me)
    };
}

export function normalizePhone(raw) {
    if (!raw) return '';
    let clean = String(raw).replace(/[^0-9]/g, '');
    if (clean.startsWith('08')) clean = '628' + clean.slice(2);
    else if (clean.startsWith('8') && clean.length >= 9 && clean.length <= 13) clean = '628' + clean.slice(1);
    else if (clean.startsWith('6208')) clean = '628' + clean.slice(4);
    else if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    return clean;
}

/**
 * Ambil JID target dari mention / reply / argumen nomor.
 */
export function resolveTarget(m, arg = '') {
    if (m.mentionedJid?.length) return m.mentionedJid[0];
    if (m.quoted?.sender) return m.quoted.sender;

    const norm = normalizePhone(arg);
    if (norm.length >= 8) {
        return `${norm}@s.whatsapp.net`;
    }
    return '';
}

/**
 * Cari participant grup yang cocok dengan JID target.
 */
export function findParticipantByJid(meta, jid) {
    return findParticipant(meta, jid, numFromJid(jid), '');
}

export const displayName = (m) =>
    m.pushName || m.senderNumber || numFromJid(m.sender) || 'User';
