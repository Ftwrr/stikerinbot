import path from 'path';

const handler = async (m, { from, args, isOwner, reply, getPlugins }) => {
    const plugins = typeof getPlugins === 'function' ? getPlugins() : [];
    const categories = new Map();

    for (const plugin of plugins) {
        if (!Array.isArray(plugin.command) || plugin.command.length === 0) continue;
        if (plugin.owner && !isOwner) continue;

        let cat = plugin.category;
        if (!cat && plugin.filePath) {
            const rel = path.relative(path.join(process.cwd(), 'plugins'), plugin.filePath);
            const dir = path.dirname(rel);
            cat = dir && dir !== '.' ? dir : 'General';
        }
        if (!cat) cat = 'General';
        cat = cat.toUpperCase();

        if (!categories.has(cat)) {
            categories.set(cat, []);
        }

        const primaryCmd = plugin.command[0];
        const desc = plugin.desc || '';
        categories.get(cat).push({
            cmd: primaryCmd,
            desc
        });
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
        return await m.sendButtons(summaryText.trim(), quickButtons, 'Stikerin Bot • Menu Utama');
    }

    await reply(summaryText.trim());
};

handler.command = ['menu', 'list', 'help'];
handler.category = 'General';
handler.limit = false;
handler.desc = 'Menampilkan menu perintah per kategori';
export default handler;
