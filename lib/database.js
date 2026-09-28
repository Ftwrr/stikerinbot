import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_DIR = path.join(process.cwd(), 'db');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_FILE = path.join(DB_DIR, 'database.sqlite');

class BotDatabase {
    constructor(dbPath = DB_FILE) {
        this.dbPath = dbPath;
        this.db = null;
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

    init() {
        try {
            this.db = new Database(this.dbPath);
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

            this.read();
        } catch (e) {
            console.error('[Database Init Error]', e);
        }
    }

    read() {
        if (!this.db) return this.data;
        try {
            const rows = this.db.prepare('SELECT category, id, data FROM bot_data').all();
            
            const categories = ['users', 'chats', 'settings', 'stats', 'msgs', 'games', 'accounts'];
            for (const cat of categories) {
                if (!this.data[cat]) this.data[cat] = {};
            }

            for (const row of rows) {
                if (!this.data[row.category]) this.data[row.category] = {};
                try {
                    this.data[row.category][row.id] = JSON.parse(row.data);
                } catch {
                    this.data[row.category][row.id] = row.data;
                }
            }
            this.isLoaded = true;
            return this.data;
        } catch (err) {
            console.error('[Database Read Error]', err);
            return this.data;
        }
    }

    async write() {
        if (!this.db || !this.isLoaded) return false;

        try {
            const insertStmt = this.db.prepare(`
                INSERT INTO bot_data (category, id, data) 
                VALUES (?, ?, ?) 
                ON CONFLICT(category, id) DO UPDATE SET data = excluded.data
            `);

            const deleteStmt = this.db.prepare('DELETE FROM bot_data WHERE category = ? AND id = ?');

            const saveTransaction = this.db.transaction(() => {
                for (const category of Object.keys(this.data)) {
                    if (typeof this.data[category] !== 'object' || this.data[category] === null) continue;

                    for (const id of Object.keys(this.data[category])) {
                        const val = this.data[category][id];
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

// Inisialisasi Database
export const db = new BotDatabase();
global.db = db;

const autoSaveTimer = setInterval(() => {
    if (global.db && global.db.isLoaded) {
        global.db.write().catch(() => {});
    }
}, 60 * 1000);
if (autoSaveTimer.unref) autoSaveTimer.unref();

const handleShutdown = async (sig) => {
    if (global.db) {
        try {
            global.db.write();
        } catch (e) {}
    }
};

process.on('SIGINT', () => { handleShutdown('SIGINT'); process.exit(0); });
process.on('SIGTERM', () => { handleShutdown('SIGTERM'); process.exit(0); });
process.on('beforeExit', () => { handleShutdown('beforeExit'); });

export default db;
