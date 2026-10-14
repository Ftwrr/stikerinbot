/**
 * rich_handler.js — Registry callback untuk balasan tombol/list (native flow).
 * Dipakai game Werewolf & fitur interaktif lain yang menunggu aksi user.
 */
const richHandlers = new Map();

export function onRichReply(id, handler) {
    richHandlers.set(id, handler);
}

export function offRichReply(id) {
    richHandlers.delete(id);
}

export function getRichHandler(id) {
    return richHandlers.get(id);
}

export default { onRichReply, offRichReply, getRichHandler };
