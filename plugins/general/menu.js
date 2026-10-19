import path from 'path';

const handler = async (m, { from, args, isOwner, reply, getPlugins }) => {
    const plugins = typeof getPlugins === 'function' ? getPlugins() : [];
    const categories = new Map();

    for (const plugin of plugins) {
        if (plugin.owner && !isOwner) continue;

        // Tentukan kategori dari plugin.tags atau nama folder parent plugin
        let rawTags = plugin.tags;
        if (!rawTags && plugin.filePath) {
            const rel = path.relative(path.join(process.cwd(), 'plugins'), plugin.filePath);
            const dir = path.dirname(rel);
            rawTags = dir && dir !== '.' ? dir : 'General';
        }
        if (!rawTags) rawTags = 'General';

        const tagList = Array.isArray(rawTags) ? rawTags : [rawTags];

        // Tentukan command list dari plugin.help atau plugin.command
        let helpList = [];
        if (Array.isArray(plugin.help) && plugin.help.length > 0) {
            helpList = plugin.help;
        } else if (typeof plugin.help === 'string' && plugin.help.trim()) {
            helpList = [plugin.help.trim()];
        } else if (Array.isArray(plugin.command) && plugin.command.length > 0) {
            helpList = [plugin.command[0]];
        }

        if (helpList.length === 0) continue;

        const desc = plugin.desc || '';

        for (const tag of tagList) {
            const catName = String(tag).trim().toUpperCase();
            if (!catName) continue;

            if (!categories.has(catName)) {
                categories.set(catName, []);
            }

            for (const item of helpList) {
                // Bersihkan prefix jika sudah ada di teks item
                const cleanItem = String(item).replace(/^\.\s*/, '');
                categories.get(catName).push({
                    cmd: cleanItem,
                    desc
                });
            }
        }
    }

    const requestedCategory = (args[0] || '').trim().toUpperCase();

    const formatCategoryBlock = (catName, cmdList) => {
        let block = `┌──「 *${catName}* 」\n`;
        for (const item of cmdList) {
            block += `│ • *.${item.cmd}*\n`;
        }
        block += `└──\n\n`;
        return block;
    };

    // 1. KATEGORI SPESIFIK
    if (requestedCategory && categories.has(requestedCategory)) {
        const cmdList = categories.get(requestedCategory);
        let catText = `📖 *MENU KATEGORI: ${requestedCategory}*\n\n`;
        catText += formatCategoryBlock(requestedCategory, cmdList);
        catText += `_Ketik *.menu* untuk melihat semua kategori._`;
        return reply(catText.trim());
    }

    // 2. MENU ALL
    if (requestedCategory === 'ALL' || requestedCategory === 'SEMUA') {
        let allText = `📖 *SEMUA PERINTAH BOT*\n\n`;
        for (const [catName, cmdList] of categories.entries()) {
            allText += formatCategoryBlock(catName, cmdList);
        }
        allText += `_Ketik nama perintah dengan awalan titik (contoh: *.ping*)_`;
        return reply(allText.trim());
    }

    // 3. MENU UTAMA
    let summaryText = `📖 *DAFTAR KATEGORI MENU*\n\n`;
    for (const [catName, cmdList] of categories.entries()) {
        summaryText += `• *.menu ${catName.toLowerCase()}* (${cmdList.length} fitur)\n`;
    }
    summaryText += `• *.menu all* (Tampilkan semua)\n\n`;
    summaryText += `_Ketik *.menu [kategori]* atau klik tombol di bawah._`;

    const quickButtons = [
        { id: '.menu all', text: '📖 Semua Menu' },
        { id: '.claim', text: '🎁 Klaim Harian' },
        { id: '.ping', text: '⚡ Ping Status' }
    ];

    if (m.sendButtons) {
        return await m.sendButtons(summaryText.trim(), quickButtons, 'AMBATRON • Menu Utama');
    }

    await reply(summaryText.trim());
};

handler.command = ['menu', 'list', 'help'];
handler.help = ['menu [kategori]'];
handler.tags = ['general'];
handler.limit = false;
handler.desc = 'Menampilkan menu perintah per kategori';
export default handler;
