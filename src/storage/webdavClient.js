'use strict';

const fs = require('fs');
const { logger } = require('../utils/logger');

class WebdavClient {
    constructor(webdavConfig, webdavHttp) {
        this.config = webdavConfig;
        this.http = webdavHttp;
    }

    getHeaders() {
        const headers = {
            Accept: '*/*',
        };

        if (this.config.authType === 'bearer') {
            headers.Authorization = `Bearer ${this.config.password}`;
        } else if (this.config.username || this.config.password) {
            const token = Buffer.from(
                `${this.config.username || ''}:${this.config.password || ''}`,
                'utf8'
            ).toString('base64');
            headers.Authorization = `Basic ${token}`;
        }

        return headers;
    }

    normalizeUrl(baseUrl, subPath = '') {
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const cleanSub = subPath.replace(/^\/+/, '').replace(/\/+$/, '');
        return cleanSub ? `${cleanBase}/${cleanSub}` : cleanBase;
    }

    async ensureDirectory(destPath) {
        if (!destPath || destPath === '/' || destPath === '.') {
            return;
        }

        const clean = destPath.replace(/^\/+/, '').replace(/\/+$/, '');
        const segments = clean.split('/').filter(Boolean);

        let accumulated = '';
        for (const segment of segments) {
            accumulated = accumulated ? `${accumulated}/${segment}` : segment;
            const dirUrl = this.normalizeUrl(this.config.url, accumulated) + '/';

            try {
                logger.debug(`Ensuring WebDAV collection exists: ${dirUrl}`, 'WebDAV');
                await this.http({
                    method: 'MKCOL',
                    url: dirUrl,
                    headers: this.getHeaders(),
                });
                logger.debug(`Created WebDAV collection: ${accumulated}`, 'WebDAV');
            } catch (err) {
                const status = err?.response?.status;
                // 405: Collection already exists (RFC 4918 Section 9.3.1)
                // 301 / 302: Redirect
                if (status === 405 || status === 301 || status === 302) {
                    continue;
                }
                // If 409 (Conflict), previous parent might be needed
                if (status !== 200 && status !== 201 && status !== 204) {
                    logger.warn(
                        `WebDAV MKCOL warning for '${accumulated}': status ${status || err.message}`,
                        'WebDAV'
                    );
                }
            }
        }
    }

    async upload({ filePath, fileName, destPath }) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File to upload does not exist: ${filePath}`);
        }

        const targetDest = destPath || this.config.destPath || '';
        await this.ensureDirectory(targetDest);

        const targetDirUrl = this.normalizeUrl(this.config.url, targetDest);
        const targetFileUrl = `${targetDirUrl}/${encodeURIComponent(fileName)}`;

        const fileSize = fs.statSync(filePath).size;
        const readStream = fs.createReadStream(filePath);

        logger.debug(`Streaming WebDAV PUT to ${targetFileUrl} (${fileSize} bytes)...`, 'WebDAV');

        let response;
        try {
            response = await this.http({
                method: 'PUT',
                url: targetFileUrl,
                data: readStream,
                headers: {
                    ...this.getHeaders(),
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': fileSize,
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });
        } catch (err) {
            let errorDetail = err.message;
            if (err?.response) {
                const preview = typeof err.response.data === 'string'
                    ? err.response.data.slice(0, 300)
                    : JSON.stringify(err.response.data || {});
                errorDetail = `HTTP ${err.response.status} (${err.response.statusText}): ${preview}`;
            }
            throw new Error(`WebDAV upload failed for '${fileName}'. ${errorDetail}`);
        }

        const isSuccess = response.status >= 200 && response.status < 300;
        if (!isSuccess) {
            throw new Error(`WebDAV upload rejected with status ${response.status}`);
        }

        return {
            status: '1',
            uploadedName: fileName,
            uploadedSize: fileSize,
            raw: {
                status: response.status,
                statusText: response.statusText,
                url: targetFileUrl,
            },
            driver: 'webdav',
        };
    }
}

module.exports = {
    WebdavClient,
};
