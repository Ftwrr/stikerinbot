import axios from 'axios';

/**
 * Universal Scraper murni menggunakan helper global.API('zans', ...)
 */
export async function downloadWithZans(url) {
    const cleanUrl = url.trim();

    // 1. INSTAGRAM & IG REELS
    if (/instagram\.com/i.test(cleanUrl)) {
        try {
            const apiUrl = global.API('zans', '/api/download/instagram', { url: cleanUrl });
            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data;
            if (data?.status && data.result) {
                const results = Array.isArray(data.result) ? data.result : [data.result];
                const mediaList = results.map(item => {
                    const u = typeof item === 'string' ? item : item.url || item.download_url;
                    const isVid = u.includes('.mp4') || (typeof item === 'object' && item.type === 'video');
                    return { url: u, type: isVid ? 'video' : 'image' };
                }).filter(m => m.url);

                if (mediaList.length > 0) {
                    return { platform: 'Instagram', media: mediaList };
                }
            }
        } catch (e) {}
    }

    // 2. TIKTOK & DOUYIN
    if (/tiktok\.com|douyin\.com/i.test(cleanUrl)) {
        const isDouyin = /douyin\.com/i.test(cleanUrl);
        const ep = isDouyin ? '/api/download/douyin' : '/api/download/tiktok';
        try {
            const apiUrl = global.API('zans', ep, { url: cleanUrl });
            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (data) {
                const title = data.title || data.desc || '';
                const mediaList = [];

                if (data.isSlide && Array.isArray(data.images)) {
                    data.images.forEach(img => mediaList.push({ url: typeof img === 'string' ? img : img.url, type: 'image' }));
                } else if (data.result || data.play || data.video) {
                    const vidUrl = data.result || data.play || data.video;
                    mediaList.push({ url: vidUrl, type: 'video' });
                }

                if (mediaList.length > 0) {
                    return { platform: isDouyin ? 'Douyin' : 'TikTok', title, media: mediaList };
                }
            }
        } catch (e) {}
    }

    // 3. FACEBOOK
    if (/facebook\.com|fb\.watch|fb\.gg/i.test(cleanUrl)) {
        try {
            const apiUrl = global.API('zans', '/api/download/facebook', { url: cleanUrl });
            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (data) {
                const vidUrl = data.hd || data.sd || (typeof data === 'string' ? data : data.url);
                if (vidUrl) {
                    return { platform: 'Facebook', title: data.title || '', media: [{ url: vidUrl, type: 'video' }] };
                }
            }
        } catch (e) {}
    }

    // 4. TWITTER / X
    if (/twitter\.com|x\.com/i.test(cleanUrl)) {
        try {
            const apiUrl = global.API('zans', '/api/download/twitter', { url: cleanUrl });
            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (data) {
                const mediaList = [];
                if (data.video || data.url) mediaList.push({ url: data.video || data.url, type: 'video' });
                if (Array.isArray(data.media)) {
                    data.media.forEach(m => mediaList.push({ url: m.url || m, type: m.type || 'video' }));
                }
                if (mediaList.length > 0) {
                    return { platform: 'Twitter', title: data.title || data.desc || '', media: mediaList };
                }
            }
        } catch (e) {}
    }

    // 5. CAPCUT
    if (/capcut\.com/i.test(cleanUrl)) {
        try {
            const apiUrl = global.API('zans', '/api/download/capcut', { url: cleanUrl });
            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (data?.video || data?.url) {
                return { platform: 'CapCut', title: data.title || '', media: [{ url: data.video || data.url, type: 'video' }] };
            }
        } catch (e) {}
    }

    // 6. PINTEREST
    if (/pinterest\.com|pin\.it/i.test(cleanUrl)) {
        try {
            const apiUrl = global.API('zans', '/api/download/pindl', { url: cleanUrl });
            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data?.data || res.data?.result || res.data;
            if (data?.url || data?.media) {
                return { platform: 'Pinterest', media: [{ url: data.url || data.media, type: 'image' }] };
            }
        } catch (e) {}
    }

    // 7. SPOTIFY & SOUNDCLOUD
    if (/spotify\.com|soundcloud\.com/i.test(cleanUrl)) {
        const isSpot = /spotify\.com/i.test(cleanUrl);
        const ep = isSpot ? '/api/download/spotify' : '/api/download/soundcloud';
        try {
            const apiUrl = global.API('zans', ep, { url: cleanUrl });
            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data?.data || res.data?.result || res.data;
            const audioUrl = data?.download_url || data?.url || data?.link || data?.audio;
            if (audioUrl) {
                return {
                    platform: isSpot ? 'Spotify' : 'SoundCloud',
                    title: data.title ? `${data.title} - ${data.artist || ''}` : '',
                    media: [{ url: audioUrl, type: 'audio' }]
                };
            }
        } catch (e) {}
    }

    // 8. YOUTUBE (YOUTUBE.COM & YOUTU.BE)
    if (/youtube\.com|youtu\.be/i.test(cleanUrl)) {
        try {
            const videoDownloadUrl = global.API('zans', '/api/download/ytmp4', { url: cleanUrl });
            return {
                platform: 'YouTube',
                title: `🎬 YouTube Video`,
                media: [{ url: videoDownloadUrl, type: 'video' }]
            };
        } catch (ytErr) {
            console.error('[YouTube Downloader Error]', ytErr.message);
        }
    }

    // 9. AIO FALLBACK
    try {
        const apiUrl = global.API('zans', '/api/download/aio', { url: cleanUrl });
        const res = await axios.get(apiUrl, { timeout: 25000 });
        const data = res.data?.data || res.data?.result;
        if (data && (data.url || data.medias)) {
            const mediaList = [];
            if (Array.isArray(data.medias)) {
                data.medias.forEach(m => mediaList.push({ url: m.url, type: m.type || (m.extension === 'mp4' ? 'video' : 'image') }));
            } else if (data.url) {
                mediaList.push({ url: data.url, type: data.type || 'video' });
            }
            if (mediaList.length > 0) {
                return { platform: 'AIO Downloader', title: data.title || '', media: mediaList };
            }
        }
    } catch (e) {}

    return null;
}
