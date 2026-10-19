// Bun otomatis membaca file .env ke process.env secara native

// Parse OWNER_NUMBER dari string comma-separated, JSON array, atau string tunggal
const parseOwnerList = (raw) => {
  if (!raw) return [];
  raw = raw.trim();
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(n => String(n).replace(/[^0-9]/g, '')).filter(Boolean);
    } catch (e) {}
  }
  return raw.split(',').map(n => n.replace(/[^0-9]/g, '')).filter(Boolean);
};

global.owner = parseOwnerList(process.env.OWNER_NUMBER || '');
global.isOwner = (numOrJid = '') => {
  if (!numOrJid) return false;
  const num = String(numOrJid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  return global.owner.includes(num);
};

// Daftar Registry Provider REST API
global.APIs = {};

// Mapping API Key dari Environment
global.APIKeys = {};

// Builder URL REST API Universal
global.API = (name, path = '/', query = {}, apikeyqueryname = 'apikey') => {
  const baseURL = name in global.APIs ? global.APIs[name] : name;
  const apikey = global.APIKeys[baseURL] || '';
  const searchParams = new URLSearchParams(Object.entries({
    ...query,
    ...(apikeyqueryname && apikey ? { [apikeyqueryname]: apikey } : {})
  }));
  const qs = searchParams.toString();
  return baseURL + path + (qs ? '?' + qs : '');
};
