// ─── ANTI-CALL GATE: dedupe event call agar tidak spam ─────────────────────
// 1 panggilan = banyak node masuk (offer, offer_notice, transport, terminate...)
// sehingga event 'call' terus ter-emit. Gate ini hanya memproses OFFER pertama
// per call-id, dan membatasi notifikasi ke caller maksimal 1x per cooldown.

const SEEN_TTL = 10 * 60 * 1000;      // call-id dianggap unik selama 10 menit
const NOTIFY_COOLDOWN = 5 * 60 * 1000; // caller terima pesan anti-call maksimal 1x / 5 menit

const seenCalls = new Map();   // callKey -> timestamp
const notifiedAt = new Map();  // callerJid -> timestamp terakhir kirim pesan

function prune(now) {
    for (const [key, ts] of seenCalls) {
        if (now - ts > SEEN_TTL) seenCalls.delete(key);
    }
    for (const [jid, ts] of notifiedAt) {
        if (now - ts > 60 * 60 * 1000) notifiedAt.delete(jid);
    }
}

/**
 * @returns {{ handle: boolean, notify: boolean }}
 *  handle = panggilan ini harus di-reject + user di-ban
 *  notify = kirim pesan peringatan ke caller (anti spam)
 */
export function evaluateAntiCall(callEvent, callerJid) {
    const now = Date.now();
    prune(now);

    const type = callEvent?.type;
    // Hanya tipe offer = panggilan masuk benar-benar masuk.
    // type undefined (event lama) tetap diproses, nanti dikunci oleh call-id.
    if (type && type !== 'offer' && type !== 'offer_notice') {
        return { handle: false, notify: false };
    }

    const key = callEvent?.callId
        ? String(callEvent.callId)
        : `${callerJid}|${callEvent?.timestampSeconds || ''}|${type || 'unknown'}`;

    if (seenCalls.has(key)) {
        return { handle: false, notify: false };
    }
    seenCalls.set(key, now);

    const last = notifiedAt.get(callerJid) || 0;
    const notify = (now - last) >= NOTIFY_COOLDOWN;
    if (notify) notifiedAt.set(callerJid, now);

    return { handle: true, notify };
}
