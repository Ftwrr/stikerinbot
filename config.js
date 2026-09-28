import fs from 'fs';
import path from 'path';

// Load .env secara mandiri tanpa dependensi tambahan
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
} catch (e) {}

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

global.APIs = {
  zans: 'https://api.zansxart.me'
};

global.APIKeys = {
  'https://api.zansxart.me': process.env.ZANS_API_KEY || ''
};

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
