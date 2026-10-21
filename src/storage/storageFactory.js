'use strict';

const { QnapClient } = require('./qnapClient');
const { WebdavClient } = require('./webdavClient');

function resolveStorageClient({ appConfig, globalConfig, qnapHttp, webdavHttp }) {
    // 1. App-level storage override, or fallback to global storage driver
    const driver = (appConfig.storageDriver || globalConfig.storageDriver || 'qnap').toLowerCase();

    if (driver === 'webdav') {
        const webdavConfig = {
            url: appConfig.webdavUrl || globalConfig.webdav.url,
            username: appConfig.webdavUsername || globalConfig.webdav.username,
            password: appConfig.webdavPassword || globalConfig.webdav.password,
            destPath: appConfig.destPath || appConfig.webdavDestPath || globalConfig.webdav.destPath,
            authType: appConfig.webdavAuthType || globalConfig.webdav.authType || 'basic',
            rejectUnauthorized: appConfig.webdavRejectUnauthorized ?? globalConfig.webdav.rejectUnauthorized,
        };

        return {
            driver: 'webdav',
            client: new WebdavClient(webdavConfig, webdavHttp),
        };
    }

    // Default to QNAP driver
    const qnapConfig = {
        host: appConfig.qnapHost || globalConfig.qnap.host,
        username: appConfig.qnapUsername || globalConfig.qnap.username,
        password: appConfig.qnapPassword || globalConfig.qnap.password,
        destPath: appConfig.destPath || appConfig.qnapDestPath || globalConfig.qnap.destPath,
        rejectUnauthorized: appConfig.qnapRejectUnauthorized ?? globalConfig.qnap.rejectUnauthorized,
    };

    return {
        driver: 'qnap',
        client: new QnapClient(qnapConfig, qnapHttp),
    };
}

module.exports = {
    resolveStorageClient,
};
