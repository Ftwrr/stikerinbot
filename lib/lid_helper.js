import fs from 'fs';
import path from 'path';

const AUTH_DIR = './session_auth';
const LID_CACHE_FILE = './db/lid_mapping_cache.json';

let _lidMap = new Map();

function loadLidCache() {
  if (fs.existsSync(LID_CACHE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LID_CACHE_FILE, 'utf8'));
      _lidMap = new Map(Object.entries(data));
    } catch (e) {}
  }
}

function saveLidCache() {
  try {
    const obj = Object.fromEntries(_lidMap);
    fs.writeFileSync(LID_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {}
}

loadLidCache();

export function saveLidPhoneMapping(lid, pn) {
  if (!lid || !pn) return;
  const cleanLid = String(lid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  let cleanPn = String(pn).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  if (cleanPn.startsWith('08')) cleanPn = '628' + cleanPn.slice(2);

  if (cleanLid && cleanPn && cleanPn.length >= 10 && cleanLid !== cleanPn) {
    if (!_lidMap.has(cleanLid)) {
      _lidMap.set(cleanLid, cleanPn);
      saveLidCache();
    }
  }
}

export function resolvePhoneNumberFromLid(lid) {
  if (!lid) return '';
  const cleanLid = String(lid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  return _lidMap.get(cleanLid) || '';
}

/**
 * Resolve sender WhatsApp LID to actual Phone Number
 */
export function resolvePhoneNumberFromMsg(msg, sockInstance = null) {
  if (!msg) return '';

  const candidates = [
    msg.key?.participantAlt,
    msg.key?.remoteJidAlt,
    msg.rawNode?.attrs?.participant_pn,
    msg.participantAlt,
    msg.remoteJidAlt,
    msg.key?.participant,
    msg.key?.remoteJid,
    msg.sender,
    msg.chat
  ];

  // 1. Direct phone JID from candidates
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.endsWith('@s.whatsapp.net')) {
      const num = c.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      if (num && num.length >= 10 && num.length <= 15) return num;
    }
  }

  // 2. Extract LID ID and check mapping
  let lidId = '';
  for (const c of candidates) {
    if (c && typeof c === 'string' && (c.endsWith('@lid') || !c.includes('@'))) {
      lidId = c.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      if (lidId) break;
    }
  }

  if (lidId) {
    // Check in-memory fast LID cache
    if (_lidMap.has(lidId)) {
      return _lidMap.get(lidId);
    }

    // Check disk Baileys auth lid-mapping store
    const lidReverseFile = path.join(AUTH_DIR, `lid-mapping-${lidId}_reverse.json`);
    if (fs.existsSync(lidReverseFile)) {
      try {
        const raw = fs.readFileSync(lidReverseFile, 'utf8');
        const phoneJid = JSON.parse(raw);
        if (typeof phoneJid === 'string') {
          const num = phoneJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
          if (num && num.length >= 10 && num.length <= 15) {
            saveLidPhoneMapping(lidId, num);
            return num;
          }
        }
      } catch (e) {}
    }
  }

  return '';
}
