'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

require('dotenv').config({ override: true });

function toBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeHost(url) {
    if (!url) return '';
    return url.replace(/\/+$/, '');
}

function resolvePath(dir) {
    if (!dir) return path.resolve(process.cwd(), './runtime');
    return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

// 1. Resolve Global QNAP Config
const qnapConfig = {
    host: normalizeHost(process.env.QNAP_HOST || 'http://127.0.0.1:8080'),
    username: process.env.QNAP_USERNAME || 'admin',
    password: process.env.QNAP_PASSWORD || '',
    destPath: process.env.QNAP_DEST_PATH || '/home/backup',
    rejectUnauthorized: toBoolean(process.env.QNAP_TLS_REJECT_UNAUTHORIZED, true),
};

// 2. Resolve Global WebDAV Config (Nextcloud, ownCloud, NAS WebDAV, etc.)
const webdavConfig = {
    url: normalizeHost(process.env.WEBDAV_URL || 'http://127.0.0.1:5005'),
    username: process.env.WEBDAV_USERNAME || '',
    password: process.env.WEBDAV_PASSWORD || '',
    destPath: process.env.WEBDAV_DEST_PATH || '/backup',
    authType: (process.env.WEBDAV_AUTH_TYPE || 'basic').toLowerCase(),
    rejectUnauthorized: toBoolean(process.env.WEBDAV_TLS_REJECT_UNAUTHORIZED, true),
};

const defaultStorageDriver = (process.env.STORAGE_DRIVER || 'qnap').toLowerCase();

// 3. Resolve Apps List (Single-App vs Multi-App Fleet)
function loadTargetApps() {
    const appsConfigPath = process.env.APPS_CONFIG_PATH;

    if (appsConfigPath) {
        const fullPath = path.resolve(process.cwd(), appsConfigPath);
        if (fs.existsSync(fullPath)) {
            const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            if (Array.isArray(raw)) {
                return raw.map((app) => {
                    const storageDriver = (app.storage || app.storageDriver || defaultStorageDriver).toLowerCase();
                    const defaultDest = storageDriver === 'webdav'
                        ? `${webdavConfig.destPath}/${app.name}`
                        : `${qnapConfig.destPath}/${app.name}`;

                    return {
                        name: app.name || 'app',
                        serviceName: app.serviceName || `backup-puller-${app.name || 'app'}`,
                        baseUrl: normalizeHost(app.apiBaseUrl || app.baseUrl),
                        apiKey: app.apiKey,
                        metadataPath: app.metadataPath || '/api/backups/latest/metadata',
                        downloadPath: app.downloadPath || '/api/backups/latest/download',
                        reportPath: app.reportPath || '/api/service-reports',
                        backupTypes: app.backupTypes || ['database', 'attachments'],
                        backupFresh: toBoolean(app.backupFresh, false),
                        storageDriver,
                        destPath: app.destPath || app.qnapDestPath || app.webdavDestPath || defaultDest,
                        qnapDestPath: app.qnapDestPath || `${qnapConfig.destPath}/${app.name}`,
                        webdavDestPath: app.webdavDestPath || `${webdavConfig.destPath}/${app.name}`,
                        webdavUrl: app.webdavUrl,
                        webdavUsername: app.webdavUsername,
                        webdavPassword: app.webdavPassword,
                        uploadPolicy: (app.uploadPolicy || process.env.UPLOAD_POLICY || 'dedupe').toLowerCase(),
                        rejectUnauthorized: toBoolean(app.rejectUnauthorized, false),
                    };
                });
            }
        }
    }

    // Fallback to Single-App from .env (with backward compatible aliases)
    const appName = process.env.APP_NAME ||
                    (process.env.PANJALU_API_BASE_URL ? 'panjalu' : null) ||
                    (process.env.KADIRI_API_BASE_URL ? 'kadiri' : null) ||
                    'app';

    const baseUrl = normalizeHost(
        process.env.APP_API_BASE_URL ||
        process.env.PANJALU_API_BASE_URL ||
        process.env.KADIRI_API_BASE_URL ||
        'http://localhost:8000'
    );

    const apiKey =
        process.env.APP_API_KEY ||
        process.env.PANJALU_API_KEY ||
        process.env.KADIRI_API_KEY ||
        '';

    const serviceName =
        process.env.SERVICE_NAME ||
        `backup-puller-${appName}`;

    const backupTypesRaw = process.env.BACKUP_TYPES || 'database,attachments';
    const backupTypes = backupTypesRaw.split(',').map((t) => t.trim()).filter(Boolean);

    const defaultDest = defaultStorageDriver === 'webdav'
        ? (process.env.WEBDAV_DEST_PATH || `/backup/${appName}`)
        : (process.env.QNAP_DEST_PATH || `/home/backup/${appName}`);

    return [
        {
            name: appName,
            serviceName,
            baseUrl,
            apiKey,
            metadataPath: process.env.APP_BACKUP_METADATA_PATH ||
                          process.env.PANJALU_BACKUP_METADATA_PATH ||
                          process.env.KADIRI_BACKUP_METADATA_PATH ||
                          '/api/backups/latest/metadata',
            downloadPath: process.env.APP_BACKUP_DOWNLOAD_PATH ||
                          process.env.PANJALU_BACKUP_DOWNLOAD_PATH ||
                          process.env.KADIRI_BACKUP_DOWNLOAD_PATH ||
                          '/api/backups/latest/download',
            reportPath: process.env.APP_SERVICE_REPORT_PATH ||
                        process.env.PANJALU_SERVICE_REPORT_PATH ||
                        process.env.KADIRI_SERVICE_REPORT_PATH ||
                        '/api/service-reports',
            backupTypes,
            backupFresh: toBoolean(
                process.env.BACKUP_FRESH ??
                process.env.PANJALU_BACKUP_FRESH ??
                process.env.KADIRI_BACKUP_FRESH,
                false
            ),
            storageDriver: defaultStorageDriver,
            destPath: defaultDest,
            qnapDestPath: process.env.QNAP_DEST_PATH || `/home/backup/${appName}`,
            webdavDestPath: process.env.WEBDAV_DEST_PATH || `/backup/${appName}`,
            uploadPolicy: (process.env.UPLOAD_POLICY || 'dedupe').toLowerCase(),
            rejectUnauthorized: toBoolean(
                process.env.APP_TLS_REJECT_UNAUTHORIZED ??
                process.env.PANJALU_TLS_REJECT_UNAUTHORIZED ??
                process.env.KADIRI_TLS_REJECT_UNAUTHORIZED,
                true
            ),
        },
    ];
}

const config = {
    runIntervalMinutes: Number(process.env.RUN_INTERVAL_MINUTES || 0),
    uploadPolicy: (process.env.UPLOAD_POLICY || 'dedupe').toLowerCase(),
    backupTimezone: process.env.BACKUP_TIMEZONE || 'Asia/Jakarta',
    forceUpload: toBoolean(process.env.FORCE_UPLOAD, false),
    keepLocalFile: toBoolean(process.env.KEEP_LOCAL_FILE, false),
    uploadAsZip: toBoolean(process.env.UPLOAD_AS_ZIP, true),
    zipCompressionLevel: Number(process.env.ZIP_COMPRESSION_LEVEL || 9),
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 180000),
    tempDir: resolvePath(process.env.WORK_DIR || './runtime/temp'),
    stateDir: resolvePath(process.env.STATE_DIR || './runtime/state'),
    storageDriver: defaultStorageDriver,
    qnap: qnapConfig,
    webdav: webdavConfig,
    apps: loadTargetApps(),
};

function createAxiosForApp(appConfig) {
    return axios.create({
        timeout: config.requestTimeoutMs,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        httpsAgent: new https.Agent({
            rejectUnauthorized: appConfig.rejectUnauthorized,
        }),
    });
}

function createAxiosForQnap() {
    return axios.create({
        timeout: config.requestTimeoutMs,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        httpsAgent: new https.Agent({
            rejectUnauthorized: config.qnap.rejectUnauthorized,
        }),
    });
}

function createAxiosForWebdav() {
    return axios.create({
        timeout: config.requestTimeoutMs,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        httpsAgent: new https.Agent({
            rejectUnauthorized: config.webdav.rejectUnauthorized,
        }),
    });
}

module.exports = {
    config,
    createAxiosForApp,
    createAxiosForQnap,
    createAxiosForWebdav,
};
