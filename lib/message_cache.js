import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'db');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const CACHE_DB_FILE = path.join(DB_DIR, 'message_cache.sqlite');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 Jam

class MessageCache {
    constructor() {
        this.db = new Database(CACHE_DB_FILE);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
        `);

        this.insertStmt = this.db.prepare(`
            INSERT OR REPLACE INTO messages (id, data, timestamp)
            VALUES (?, ?, ?)
        `);
        this.getStmt = this.db.prepare(`SELECT data FROM messages WHERE id = ?`);
        this.cleanStmt = this.db.prepare(`DELETE FROM messages WHERE timestamp < ?`);

        // ponytail: SQLite indexed cleanup every 1 hr. If traffic exceeds 100k msg/day, switch to in-memory LRU ring
        const timer = setInterval(() => this.clean(), 60 * 60 * 1000);
        if (timer.unref) timer.unref();
    }

    save(msg) {
        if (!msg?.key?.id) return;
        try {
            const dataStr = JSON.stringify(msg);
            this.insertStmt.run(msg.key.id, dataStr, Date.now());
        } catch (e) {
            console.error('[MessageCache Save Error]', e.message);
        }
    }

    get(id) {
        if (!id) return null;
        try {
            const row = this.getStmt.get(id);
            if (!row) return null;
            return JSON.parse(row.data);
        } catch {
            return null;
        }
    }

    clean() {
        try {
            const expireBefore = Date.now() - MAX_AGE_MS;
            this.cleanStmt.run(expireBefore);
        } catch (e) {
            console.error('[MessageCache Clean Error]', e.message);
        }
    }
}

export const messageCache = new MessageCache();
export default messageCache;
