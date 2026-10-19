import fs from 'fs';
import path from 'path';

const DOCS = [
    { url: 'https://zapo.to/llms.txt', file: 'llms.txt' },
    { url: 'https://zapo.to/llms-full.txt', file: 'llms-full.txt' }
];

async function updateDocs() {
    console.log('🔄 Memperbarui dokumentasi Zapo dari zapo.to...');
    for (const { url, file } of DOCS) {
        try {
            console.log(`⏳ Mengunduh ${url}...`);
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
            const text = await res.text();
            fs.writeFileSync(path.join(process.cwd(), file), text, 'utf8');
            console.log(`✅ Berhasil memperbarui ${file} (${(text.length / 1024).toFixed(1)} KB)`);
        } catch (err) {
            console.error(`❌ Gagal mengunduh ${file}:`, err.message);
        }
    }
    console.log('🎉 Sinkronisasi dokumentasi selesai!');
}

updateDocs();
