import { exec } from 'child_process';

const handler = async (msg, { text, reply }) => {
    if (!text) return reply('⚠️ Masukkan perintah terminal bash. Contoh: *.exec df -h*');
    
    exec(text, { timeout: 30000, maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
        const out = stdout || stderr || (error ? error.message : 'Done (no output)');
        await reply(`💻 *EXEC RESULT:*\n\`\`\`\n${out.trim().substring(0, 3000)}\n\`\`\``);
    });
};

handler.command = ['exec', 'sh', 'bash'];
handler.help = ['exec <perintah>'];
handler.tags = ['owner'];
handler.desc = 'Eksekusi terminal bash';
handler.owner = true;
export default handler;
