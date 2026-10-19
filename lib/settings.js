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
