'use strict';

const fs = require('fs');
const FormData = require('form-data');
const {
    parseQnapResponse,
    isQnapSuccess,
    qnapUploadedInfo,
    qnapStatusValue,
    qnapResponsePreview,
} = require('./qnapResponse');
const { logger } = require('../utils/logger');

class QnapClient {
    constructor(qnapConfig, qnapHttp) {
        this.config = qnapConfig;
        this.http = qnapHttp;
        this.cachedSid = null;
    }

    async getSid(forceRefresh = false) {
        if (this.cachedSid && !forceRefresh) {
            return this.cachedSid;
        }

        const encodedPassword = Buffer.from(this.config.password, 'utf8').toString('base64');
        const loginUrl = `${this.config.host}/cgi-bin/authLogin.cgi`;

        logger.debug(`Authenticating to QNAP at ${loginUrl} as ${this.config.username}`, 'QNAP');

        const response = await this.http.get(loginUrl, {
            params: {
                user: this.config.username,
                pwd: encodedPassword,
            },
            responseType: 'text',
        });

        const parsed = parseQnapResponse(response.data);

        // Find SID in diverse response paths
        const sid =
            parsed?.QDocRoot?.authSid ||
            parsed?.authSid ||
            parsed?.AuthSid ||
            parsed?.QDocRoot?.AuthSid ||
            parsed?.QDocRoot?.auth_sid;

        if (!sid) {
            const preview = qnapResponsePreview(parsed);
            const authPassed = parsed?.QDocRoot?.authPassed ?? parsed?.authPassed;

            if (authPassed === 0 || authPassed === '0') {
                throw new Error(
                    `QNAP authentication failed (authPassed=0). Check QNAP_USERNAME and QNAP_PASSWORD. Response: ${preview}`
                );
            }

            throw new Error(`Failed to retrieve QNAP auth SID. Response: ${preview}`);
        }

        this.cachedSid = String(sid);
        return this.cachedSid;
    }

    async upload({ filePath, fileName, destPath }) {
        let sid = await this.getSid();
        const uploadUrl = `${this.config.host}/cgi-bin/filemanager/utilRequest.cgi`;
        const targetDest = destPath || this.config.destPath;
        const progressTag = targetDest.replace(/^\/+/, '').replace(/\//g, '-');

        const queryParams = {
            func: 'upload',
            type: 'standard',
            sid,
            dest_path: targetDest,
            overwrite: 1,
            progress: `-${progressTag}-${fileName}`,
        };

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath), fileName);

        let response;
        try {
            response = await this.http.post(uploadUrl, form, {
                headers: form.getHeaders(),
                params: queryParams,
                responseType: 'text',
            });
        } catch (err) {
            // If SID expired (401 or CGI reject), refresh and retry once
            if (err?.response?.status === 401 || err?.response?.status === 403) {
                logger.warn('QNAP session expired, refreshing SID and retrying upload...', 'QNAP');
                sid = await this.getSid(true);
                queryParams.sid = sid;

                const retryForm = new FormData();
                retryForm.append('file', fs.createReadStream(filePath), fileName);

                response = await this.http.post(uploadUrl, retryForm, {
                    headers: retryForm.getHeaders(),
                    params: queryParams,
                    responseType: 'text',
                });
            } else {
                throw err;
            }
        }

        const parsed = parseQnapResponse(response.data);

        if (!isQnapSuccess(parsed)) {
            throw new Error(
                `QNAP upload rejected for '${fileName}'. Response: ${qnapResponsePreview(parsed)}`
            );
        }

        const fallbackSize = fs.statSync(filePath).size;
        const uploaded = qnapUploadedInfo(parsed, fileName, fallbackSize);
        const status = qnapStatusValue(parsed);

        return {
            status: String(status),
            uploadedName: uploaded.name,
            uploadedSize: uploaded.size,
            raw: parsed,
        };
    }
}

module.exports = {
    QnapClient,
};
