import fs from 'fs';

const AUTH_DIR_NAME = process.env.SESSION_DIR || 'session_auth';
const SETTING_FILE = `./db/settings-${AUTH_DIR_NAME}.json`;

export function getBotSettings() {
    if (fs.existsSync(SETTING_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(SETTING_FILE, 'utf8'));
            return {
                autoReadStatus: typeof data.autoReadStatus === 'boolean' ? data.autoReadStatus : true,
                autoReadMessage: typeof data.autoReadMessage === 'boolean' ? data.autoReadMessage : false,
                antiCall: typeof data.antiCall === 'boolean' ? data.antiCall : false,
                autoDownload: typeof data.autoDownload === 'boolean' ? data.autoDownload : true,
                groupMode: typeof data.groupMode === 'boolean' ? data.groupMode : true,
                publicMode: typeof data.publicMode === 'boolean' ? data.publicMode : true
            };
        } catch (e) {}
    }
    return {
        autoReadStatus: true,
        autoReadMessage: false,
        antiCall: false,
        autoDownload: true,
        groupMode: true,
        publicMode: true
    };
}

export function updateBotSettings(newSettings = {}) {
    let data = getBotSettings();
    data = { ...data, ...newSettings };
    try {
        fs.writeFileSync(SETTING_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
    return data;
}

export function isFreeLimitChat(m) {
    if (!m || !m.isGroup) return false;

    // 1. Cek subject / name grup
    const chatName = String(m.chatName || m.chatTargetName || '').toLowerCase();
    if (chatName.includes('stikerin')) return true;

    // 2. Cek database chats apakah official, free, atau ada sewa aktif
    const chatData = global.db?.data?.chats?.[m.chat];
    if (chatData?.isOfficial || chatData?.free || chatData?.isFree) return true;
    if (chatData?.joinExpiry && chatData.joinExpiry > Date.now()) return true;

    // 3. Known official group JIDs / IDs
    const officialJids = [
        '6289687873636-1616548035@g.us',
        '120363412849856864@g.us',
        '6593893239-1425371873@g.us',
        '120363303617538942@g.us',
        '120363429526548171@g.us'
    ];
    if (officialJids.includes(m.chat)) return true;

    return false;
}
