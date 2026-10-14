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

/**
 * Ambil JID target dari mention / reply / argumen nomor.
 */
export function resolveTarget(m, arg = '') {
    if (m.mentionedJid?.length) return m.mentionedJid[0];
    if (m.quoted?.sender) return m.quoted.sender;

    const clean = String(arg).replace(/[^0-9]/g, '');
    if (clean.length >= 8) {
        const n = clean.startsWith('0') ? `62${clean.slice(1)}` : clean;
        return `${n}@s.whatsapp.net`;
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
