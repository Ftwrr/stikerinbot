function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const parts = [];
    if (days > 0) parts.push(`${days} Hari`);
    if (hours > 0 || days > 0) parts.push(`${hours} Jam`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes} Menit`);
    parts.push(`${secs} Detik`);
    return parts.join(" ");
}

import os from 'os';
import { performance } from 'perf_hooks';

function formatSize(bytes) {
    if (typeof bytes !== 'number' || isNaN(bytes)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }
    return `${bytes.toFixed(2)} ${units[i]}`;
}

const handler = async (m, { client, reply }) => {
    const old = performance.now();

    // Hitung total chat & group dari DB
    const allChats = Object.keys(global.db?.data?.chats || {});
    const listGroup = allChats.filter((jid) => jid.endsWith('@g.us'));
    const allUsers = Object.keys(global.db?.data?.users || {});
    const personalChats = allUsers.filter((jid) => jid.endsWith('@s.whatsapp.net'));
    const registeredUsers = personalChats.filter((jid) => global.db?.data?.users?.[jid]?.registered).length;

    // Memory & CPU
    const used = process.memoryUsage();
    const cpus = os.cpus() || [];
    const cpuTotalTimes = cpus.map((cpu) => {
        const total = Object.keys(cpu.times).reduce((last, type) => last + cpu.times[type], 0);
        return { ...cpu, total };
    });

    const cpu = cpuTotalTimes.reduce(
        (last, c, _, { length }) => {
            last.total += c.total;
            last.speed += c.speed / (length || 1);
            last.times.user += c.times.user;
            last.times.nice += c.times.nice;
            last.times.sys += c.times.sys;
            last.times.idle += c.times.idle;
            last.times.irq += c.times.irq;
            return last;
        },
        { speed: 0, total: 0, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }
    );

    const readMore = String.fromCharCode(8206).repeat(4001);
    const neww = performance.now();
    const speed = (neww - old).toFixed(4);

    const txt = `⚡ Merespon dalam *${speed}* millidetik
${readMore}
💬 *Statistik Chat:*
• *${listGroup.length}* Grup Terdaftar
• *${registeredUsers}* Pengguna Terdaftar
• *${allUsers.length}* Total User Terdata

📱 *Info Perangkat Server:*
• RAM: *${formatSize(os.totalmem() - os.freemem())}* / *${formatSize(os.totalmem())}*
• Platform: *${os.type()} (${os.arch()})*
• Uptime Server: *${formatUptime(os.uptime())}*

_NodeJS / Bun Memory Usage:_
\`\`\`
${Object.keys(used)
    .map((key) => `${key.padEnd(10, ' ')}: ${formatSize(used[key])}`)
    .join('\n')}
\`\`\`

${cpus[0] ? `_Total CPU Usage:_
*${cpus[0].model.trim()}* (${cpu.speed.toFixed(0)} MHz)
${Object.keys(cpu.times)
    .map((type) => `• *${type}*: ${((100 * cpu.times[type]) / (cpu.total || 1)).toFixed(2)}%`)
    .join('\n')}` : ''}`.trim();

    await reply(txt);
};

handler.command = ['ping', 'speed', 'p'];
handler.help = ['ping'];
handler.tags = ['general'];
handler.desc = 'Cek kecepatan respon bot & spesifikasi server lengkap';
handler.limit = false;
handler.owner = false;
handler.premium = false;
handler.group = false;
handler.private = false;
handler.register = false;
handler.delay = true;
export default handler;
