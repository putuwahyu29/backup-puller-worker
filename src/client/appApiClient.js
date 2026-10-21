'use strict';

const fs = require('fs');

class AppApiClient {
    constructor(appConfig, axiosInstance) {
        this.config = appConfig;
        this.http = axiosInstance;
    }

    getHeaders() {
        return {
            'X-API-Key': this.config.apiKey,
            Accept: 'application/json',
        };
    }

    async getMetadata(type = 'database', forceFresh = false) {
        const url = `${this.config.baseUrl}${this.config.metadataPath}`;
        const params = {
            type,
        };

        if (forceFresh || this.config.backupFresh || this.config.uploadPolicy === 'daily') {
            params.fresh = 1;
        }

        const response = await this.http.get(url, {
            headers: this.getHeaders(),
            params,
        });

        const data = response.data || {};
        if (!data.filename || !data.sha256) {
            throw new Error(`Invalid metadata response from App API (${this.config.name}): filename and sha256 required.`);
        }

        return data;
    }

    async downloadFile({ targetPath, filename, type = 'database' }) {
        const url = `${this.config.baseUrl}${this.config.downloadPath}`;
        const response = await this.http.get(url, {
            headers: this.getHeaders(),
            params: {
                filename,
                type,
            },
            responseType: 'stream',
        });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(targetPath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                try {
                    fs.chmodSync(targetPath, 0o666);
                } catch {
                    // Ignore on Windows
                }
                resolve();
            });

            writer.on('error', reject);
            response.data.on('error', reject);
        });
    }

    async sendReport(payload) {
        const url = `${this.config.baseUrl}${this.config.reportPath}`;
        await this.http.post(url, payload, {
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json',
            },
        });
    }
}

module.exports = {
    AppApiClient,
};
