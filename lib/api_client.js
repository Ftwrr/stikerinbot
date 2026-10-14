import axios from 'axios';
import './config.js';

const DEFAULT_TIMEOUT_MS = 25000;

export class ApiRequestError extends Error {
    constructor(message, statusCode = null, apiName = '', endpoint = '') {
        super(message);
        this.name = 'ApiRequestError';
        this.statusCode = statusCode;
        this.apiName = apiName;
        this.endpoint = endpoint;
    }
}

/**
 * Universal Multi-API Requester
 * Mendukung semua API di global.APIs & global.APIKeys ('zans', 'lol', dll)
 * ponytail: Axios instance wrapper. Add proxy rotator only if an upstream provider bans bot IP
 * 
 * @param {string} apiName Nama penyedia di global.APIs (contoh: 'zans') atau base URL
 * @param {string} endpoint Path endpoint (contoh: '/api/maker/brat')
 * @param {object} query Query parameters
 * @param {object} options Opsi axios (method, timeout, data, responseType, apikeyqueryname)
 */
export async function requestApi(apiName, endpoint = '/', query = {}, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const apikeyqueryname = options.apikeyqueryname !== undefined ? options.apikeyqueryname : 'apikey';

    // Bangun URL menggunakan helper global.API
    const url = global.API(apiName, endpoint, query, apikeyqueryname);

    try {
        const response = await axios({
            url,
            method,
            timeout: options.timeout || DEFAULT_TIMEOUT_MS,
            headers: {
                'User-Agent': 'StikerinBot/2.0.1 (Bun; WhatsApp Bot)',
                ...(options.headers || {})
            },
            data: options.data,
            responseType: options.responseType || 'json'
        });

        return response.data;
    } catch (err) {
        const status = err.response?.status;
        const rawErrMsg = err.response?.data?.message || err.response?.data?.error || err.message;

        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            throw new ApiRequestError(`Layanan [${apiName}] timeout. Server sedang sibuk.`, 408, apiName, endpoint);
        }

        if (status === 401 || status === 403) {
            throw new ApiRequestError(`API Key [${apiName}] tidak valid atau kuota habis.`, status, apiName, endpoint);
        }

        if (status === 404) {
            throw new ApiRequestError(`Endpoint atau data tidak ditemukan pada [${apiName}].`, 404, apiName, endpoint);
        }

        if (status >= 500) {
            throw new ApiRequestError(`Server penyedia [${apiName}] sedang gangguan sementara.`, status, apiName, endpoint);
        }

        throw new ApiRequestError(rawErrMsg || `Gagal request ke [${apiName}].`, status, apiName, endpoint);
    }
}

// Alias backward compatibility untuk Zans API
export const requestZansApi = (endpoint, query = {}, options = {}) => requestApi('zans', endpoint, query, options);
export const ZansApiError = ApiRequestError;

export default requestApi;
