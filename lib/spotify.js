import axios from 'axios';

const BASE_URL = 'https://spotmp3.net';
const SPOTSAVER_URL = 'https://spotsaver.net';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Origin: SPOTSAVER_URL,
    Referer: `${SPOTSAVER_URL}/`
};

export const formatDuration = (val) => {
    if (!val || isNaN(val)) return null;
    let s = Number(val);
    if (s > 10000) s = Math.round(s / 1000);
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, '0');
    return `${m}:${sec}`;
};

/**
 * Mencari lagu di Spotify via spotmp3.net
 * @param {string} query Judul lagu atau kata kunci
 * @returns {Promise<Array>} List lagu Spotify
 */
export async function searchSpotify(query) {
    if (!query || !query.trim()) {
        throw new Error('Query pencarian tidak boleh kosong.');
    }

    const { data } = await axios.get(`${BASE_URL}/api/v1/search`, {
        params: { q: query.trim() },
        headers: HEADERS,
        timeout: 30000
    });

    const tracks = data?.sections?.find((v) => v.type === 'track')?.items || [];

    return tracks.map((item) => {
        const tid = item.id || item.url?.match(/track\/([A-Za-z0-9]+)/)?.[1] || null;
        return {
            title: item.title || null,
            artist: item.subtitle || null,
            album: item.album || null,
            duration: formatDuration(item.duration_ms),
            cover: item.cover || item.image || item.thumbnail || null,
            date: item.date || item.release_date || null,
            tid,
            spotifyUrl: item.url || (tid ? `https://open.spotify.com/track/${tid}` : null)
        };
    });
}

/**
 * Mengambil link download audio MP3 Spotify via spotsaver.net
 * @param {string} url Link track Spotify (https://open.spotify.com/track/...)
 * @returns {Promise<Object>} Detail lagu dan link download audio
 */
export async function downloadSpotify(url) {
    if (!url || !url.trim()) {
        throw new Error('URL Spotify tidak boleh kosong.');
    }

    const spotifyRes = await axios.get(`${SPOTSAVER_URL}/api/spotify/`, {
        params: { url: url.trim() },
        headers: HEADERS,
        timeout: 30000
    });

    const item = spotifyRes.data?.items?.[0];
    if (!item) {
        throw new Error('Track Spotify tidak ditemukan.');
    }

    const cover = item.cover || item.image || item.thumbnail || item.album?.cover || item.album?.image || null;

    const getIdRes = await axios.post(
        `${SPOTSAVER_URL}/api/get-id/`,
        { title: item.title, artist: item.artist },
        {
            headers: { ...HEADERS, 'Content-Type': 'application/json' },
            timeout: 30000
        }
    );

    const videoId = getIdRes.data?.videoId;
    if (!videoId) {
        throw new Error('Video ID tidak ditemukan.');
    }

    const dlRes = await axios.post(
        `${SPOTSAVER_URL}/api/download/`,
        {
            videoId,
            candidateIds: [],
            format: 'mp3',
            title: `${item.title} - ${item.artist}`,
            licenseKey: null
        },
        {
            headers: { ...HEADERS, 'Content-Type': 'application/json' },
            timeout: 60000
        }
    );

    const downloadUrl =
        dlRes.data?.url ||
        dlRes.data?.download ||
        dlRes.data?.downloadUrl ||
        dlRes.data?.audio ||
        dlRes.data?.result?.url ||
        dlRes.data?.result?.download ||
        null;

    if (!downloadUrl) {
        throw new Error('URL download tidak ditemukan.');
    }

    const tid = url.match(/track\/([A-Za-z0-9]+)/)?.[1] || item.id || null;

    return {
        title: item.title || null,
        artist: item.artist || null,
        album: item.album || null,
        duration: formatDuration(item.duration),
        cover,
        date: item.release_date || item.date || null,
        spotify: tid ? `https://open.spotify.com/track/${tid}` : url,
        download: downloadUrl
    };
}

/**
 * Universal resolver: menerima link langsung atau query judul lagu
 * @param {string} queryOrUrl Link Spotify atau nama lagu
 * @returns {Promise<Object>} Detail lagu dan link download audio
 */
export async function getSpotify(queryOrUrl) {
    const input = (queryOrUrl || '').trim();
    if (!input) {
        throw new Error('Masukkan judul lagu atau link Spotify.');
    }

    const isSpotifyUrl = /spotify\.com\/track\/|spotify\.link\//i.test(input);

    if (isSpotifyUrl) {
        return await downloadSpotify(input);
    }

    const searchResults = await searchSpotify(input);
    if (!searchResults.length) {
        throw new Error(`Lagu "${input}" tidak ditemukan di Spotify.`);
    }

    const first = searchResults[0];
    if (!first.spotifyUrl) {
        throw new Error('URL Spotify tidak valid pada hasil pencarian.');
    }

    const track = await downloadSpotify(first.spotifyUrl);
    return {
        ...track,
        cover: track.cover || first.cover
    };
}

export default {
    search: searchSpotify,
    download: downloadSpotify,
    get: getSpotify,
    formatDuration
};
