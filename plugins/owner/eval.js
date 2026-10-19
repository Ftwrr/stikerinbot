import util from 'util';
import fs from 'fs';
import path from 'path';
import cp, { exec as _exec } from 'child_process';
import { promisify } from 'util';
import * as zapo from 'zapo-js';
import db from '../../lib/database.js';

const execAsync = promisify(_exec).bind(cp);

const handler = async (m, extra) => {
    const { client, from, isOwner, reply } = extra;
    if (!isOwner) return;

    const text = m.cleanText || m.text || '';
    
    // ─── 1. SHELL COMMAND ($ <cmd>) ───────────────────────────────────────────
    if (text.startsWith('$')) {
        const cmd = text.slice(1).trim();
        if (!cmd) return reply('⚠️ Masukkan perintah bash. Contoh: *$ ls -la*');

        try {
            const { stdout, stderr } = await execAsync(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 });
            const output = (stdout || stderr || 'Done (no output)').trim();
            await reply(`💻 *BASH RESULT:*\n\`\`\`\n${output.substring(0, 3000)}\n\`\`\``);
        } catch (err) {
            await reply(`❌ *BASH ERROR:*\n\`\`\`\n${(err.stdout || err.stderr || err.message).trim().substring(0, 3000)}\n\`\`\``);
        }
        return true;
    }

    // ─── 2. JAVASCRIPT EVAL (> <expr> ATAU => <expr>) ─────────────────────────
    if (text.startsWith('>') || text.startsWith('=>')) {
        const isExplicitReturn = text.startsWith('=>');
        let code = isExplicitReturn ? text.slice(2).trim() : text.slice(1).trim();
        if (!code) return reply('⚠️ Masukkan kode JavaScript yang ingin di-eval. Contoh: *> m.chat*');

        const context = {
            m,
            conn: client,
            client,
            db: global.db,
            database: global.db,
            fs,
            path,
            util,
            zapo,
            reply,
            ...extra
        };

        // Jika single expression tanpa titik koma atau 'return', bungkus dengan return
        let codeToRun = code;
        if (isExplicitReturn) {
            codeToRun = `return (${code})`;
        } else if (!code.includes(';') && !code.includes('return ') && !code.includes('\n')) {
            codeToRun = `return (${code})`;
        }

        try {
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            const fn = new AsyncFunction(...Object.keys(context), codeToRun);
            let result = await fn(...Object.values(context));
            
            let output;
            if (typeof result === 'string') {
                output = result;
            } else {
                output = util.inspect(result, { depth: 3, colors: false });
            }

            await reply(output.substring(0, 3000));
        } catch (err) {
            await reply(`❌ *EVAL ERROR:*\n\`\`\`\n${err.stack || err.message}\n\`\`\``);
        }
        return true;
    }

    return false;
};

handler.custom = true;
handler.owner = true;
handler.desc = 'JavaScript Eval (>) & Terminal Exec ($)';
export default handler;
