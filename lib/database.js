import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_DIR = path.join(process.cwd(), 'db');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const DEFAULT_SQLITE_FILE = path.join(DB_DIR, 'database.sqlite');

/**
 * Base Database Adapter Interface
 */
export class BaseDatabaseAdapter {
    async init() {}
    async read() { return {}; }
    async write(data) { return true; }
    async close() {}
}

/**
 * SQLite Adapter (Default)
 */
export class SqliteAdapter extends BaseDatabaseAdapter {
    constructor(filePath = DEFAULT_SQLITE_FILE) {
        super();
        this.filePath = filePath;
        this.db = null;
    }

    async init() {
        this.db = new Database(this.filePath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('busy_timeout = 5000');

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS bot_data (
                category TEXT,
                id TEXT,
                data TEXT,
                PRIMARY KEY (category, id)
            )
        `);
    }

    async read() {
        if (!this.db) return {};
        const rows = this.db.prepare('SELECT category, id, data FROM bot_data').all();
        const result = {};

        for (const row of rows) {
            if (!result[row.category]) result[row.category] = {};
            try {
                result[row.category][row.id] = JSON.parse(row.data);
            } catch {
                result[row.category][row.id] = row.data;
            }
        }
        return result;
    }

    async write(data) {
        if (!this.db || !data) return false;

        const insertStmt = this.db.prepare(`
            INSERT INTO bot_data (category, id, data) 
            VALUES (?, ?, ?) 
            ON CONFLICT(category, id) DO UPDATE SET data = excluded.data
        `);
        const deleteStmt = this.db.prepare('DELETE FROM bot_data WHERE category = ? AND id = ?');

        const saveTransaction = this.db.transaction(() => {
            for (const category of Object.keys(data)) {
                if (typeof data[category] !== 'object' || data[category] === null) continue;

                for (const id of Object.keys(data[category])) {
                    const val = data[category][id];
                    if (val === undefined) {
                        deleteStmt.run(category, id);
                    } else {
                        const str = typeof val === 'string' ? val : JSON.stringify(val);
                        insertStmt.run(category, id, str);
                    }
                }
            }
        });

        saveTransaction();
        return true;
    }

    async close() {
        if (this.db) {
            try { this.db.close(); } catch {}
            this.db = null;
        }
    }
}

/**
 * MongoDB Adapter Stub
 * ponytail: add actual mongodb client driver when MONGODB_URI is provided
 */
export class MongoAdapter extends BaseDatabaseAdapter {
    constructor(uri = process.env.MONGODB_URI) {
        super();
        this.uri = uri;
    }

    async init() {
        if (!this.uri) {
            throw new Error('[DB] MONGODB_URI belum dikonfigurasi di environment!');
        }
        console.log('[DB] MongoAdapter diinisialisasi:', this.uri.replace(/\/\/.*@/, '//***@'));
    }

    async read() {
        return {};
    }

    async write(data) {
        return true;
    }
}

/**
 * Supabase Adapter Stub
 * ponytail: add @supabase/supabase-js client when SUPABASE_URL & KEY are provided
 */
export class SupabaseAdapter extends BaseDatabaseAdapter {
    constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_KEY) {
        super();
        this.url = url;
        this.key = key;
    }

    async init() {
        if (!this.url || !this.key) {
            throw new Error('[DB] SUPABASE_URL atau SUPABASE_KEY belum dikonfigurasi di environment!');
        }
        console.log('[DB] SupabaseAdapter diinisialisasi:', this.url);
    }

    async read() {
        return {};
    }

    async write(data) {
        return true;
    }
}

/**
 * Main Pluggable Database Orchestrator
 */
class BotDatabase {
    constructor() {
        this.adapter = this._resolveAdapter();
        this.data = {
            users: {},
            chats: {},
            settings: {},
            stats: {},
            msgs: {},
            games: {},
            accounts: {}
        };
        this.isLoaded = false;
        this.saveTimer = null;
        this.init();
    }

    _resolveAdapter() {
        const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
        switch (driver) {
            case 'mongodb':
            case 'mongo':
                return new MongoAdapter();
            case 'supabase':
                return new SupabaseAdapter();
            case 'sqlite':
            default:
                return new SqliteAdapter();
        }
    }

    async init() {
        try {
            await this.adapter.init();
            await this.read();
        } catch (e) {
            console.error('[Database Init Error]', e);
        }
    }

    async read() {
        try {
            const rawData = await this.adapter.read();
            const categories = ['users', 'chats', 'settings', 'stats', 'msgs', 'games', 'accounts'];
            for (const cat of categories) {
                this.data[cat] = { ...this.data[cat], ...(rawData[cat] || {}) };
            }
            this.isLoaded = true;
            return this.data;
        } catch (err) {
            console.error('[Database Read Error]', err);
            return this.data;
        }
    }

    async write() {
        if (!this.isLoaded) return false;
        try {
            await this.adapter.write(this.data);
            return true;
        } catch (err) {
            console.error('[Database Write Error]', err);
            return false;
        }
    }

    scheduleSave() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.write().catch(() => {});
        }, 1000);
    }
}

// Inisialisasi Database instance
export const db = new BotDatabase();
global.db = db;

const autoSaveTimer = setInterval(() => {
    if (global.db && global.db.isLoaded) {
        global.db.write().catch(() => {});
    }
}, 60 * 1000);
if (autoSaveTimer.unref) autoSaveTimer.unref();

const handleShutdown = async () => {
    if (global.db) {
        try {
            await global.db.write();
        } catch (e) {}
    }
};

process.on('SIGINT', () => { handleShutdown().finally(() => process.exit(0)); });
process.on('SIGTERM', () => { handleShutdown().finally(() => process.exit(0)); });
process.on('beforeExit', () => { handleShutdown(); });

export default db;
