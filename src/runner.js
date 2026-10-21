'use strict';

const path = require('path');
const { AppApiClient } = require('./client/appApiClient');
const { resolveStorageClient } = require('./storage/storageFactory');
const { StateStore } = require('./state/stateStore');
const { verifyChecksum, createZipArchive, cleanupFiles, ensureDir } = require('./utils/fileOps');
const { logger, describeAxiosError, timestamp } = require('./utils/logger');
const { createAxiosForApp, createAxiosForQnap, createAxiosForWebdav } = require('./config');

function createRunner(globalConfig) {
    let isCycleRunning = false;
    const stateStore = new StateStore(globalConfig.stateDir);
    const qnapHttp = createAxiosForQnap();
    const webdavHttp = createAxiosForWebdav();

    async function processAppBackupType(app, type) {
        const prefix = `${app.name}:${type}`;
        const appHttp = createAxiosForApp(app);
        const appClient = new AppApiClient(app, appHttp);

        ensureDir(globalConfig.tempDir);

        const state = stateStore.load(app.name, type);
        let metadata = null;
        let localFilePath = null;
        let uploadFilePath = null;
        let uploadFileName = null;
        let uploadSucceeded = false;

        // Resolve active storage destination (QNAP or WebDAV)
        const { driver: storageDriver, client: storageClient } = resolveStorageClient({
            appConfig: app,
            globalConfig,
            qnapHttp,
            webdavHttp,
        });

        try {
            logger.info(`Fetching latest backup metadata...`, prefix);
            metadata = await appClient.getMetadata(type);

            const decision = stateStore.evaluateSkip({
                policy: app.uploadPolicy || globalConfig.uploadPolicy,
                timezone: globalConfig.backupTimezone,
                forceUpload: globalConfig.forceUpload,
                state,
                metadata,
            });

            if (decision.skip) {
                logger.info(decision.message, prefix);
                return;
            }

            localFilePath = path.join(globalConfig.tempDir, `${app.name}-${metadata.filename}`);
            logger.info(`Downloading backup file: ${metadata.filename} (${metadata.size_bytes} bytes)...`, prefix);

            await appClient.downloadFile({
                targetPath: localFilePath,
                filename: metadata.filename,
                type,
            });

            logger.info(`Verifying SHA-256 checksum...`, prefix);
            await verifyChecksum(localFilePath, metadata.sha256);

            uploadFilePath = localFilePath;
            uploadFileName = metadata.filename;

            const isAlreadyCompressed =
                uploadFileName.toLowerCase().endsWith('.zip') ||
                uploadFileName.toLowerCase().endsWith('.gz') ||
                uploadFileName.toLowerCase().endsWith('.tar');

            if (globalConfig.uploadAsZip && !isAlreadyCompressed) {
                uploadFilePath = `${localFilePath}.zip`;
                uploadFileName = `${metadata.filename}.zip`;
                logger.info(`Compressing to ZIP: ${uploadFileName}...`, prefix);
                await createZipArchive(
                    localFilePath,
                    metadata.filename,
                    uploadFilePath,
                    globalConfig.zipCompressionLevel
                );
            }

            // Determine destination subfolder (e.g. /home/backup/panjalu/attachments or /backup/panjalu/database)
            let targetDest = app.destPath;
            if (type === 'attachments' && !targetDest.endsWith('/attachments')) {
                targetDest = `${targetDest}/attachments`;
            } else if (type === 'database' && !targetDest.endsWith('/database') && app.backupTypes.length > 1) {
                targetDest = `${targetDest}/database`;
            }

            logger.info(`Uploading to [${storageDriver.toUpperCase()}]: ${uploadFileName} -> ${targetDest}...`, prefix);
            const uploadResult = await storageClient.upload({
                filePath: uploadFilePath,
                fileName: uploadFileName,
                destPath: targetDest,
            });

            uploadSucceeded = true;
            logger.info(
                `Upload to [${storageDriver.toUpperCase()}] confirmed! File: ${uploadResult.uploadedName}, Size: ${uploadResult.uploadedSize} bytes`,
                prefix
            );

            // Update State
            stateStore.save(app.name, type, {
                last_filename: metadata.filename,
                last_sha256: metadata.sha256,
                last_uploaded_object: uploadFileName,
                last_daily_key: decision.dailyKey || state.last_daily_key || null,
                last_uploaded_at: timestamp(),
                last_storage_driver: storageDriver,
            });

            // Report Success to origin App API
            try {
                await appClient.sendReport({
                    service: app.serviceName,
                    status: 'success',
                    filename: metadata.filename,
                    sha256: metadata.sha256,
                    uploaded_object: uploadResult.uploadedName || uploadFileName,
                    uploaded_size: uploadResult.uploadedSize,
                    reported_at: timestamp(),
                    meta: {
                        type,
                        app: app.name,
                        storage_driver: storageDriver,
                        storage_dest: targetDest,
                        upload_status: uploadResult.status,
                    },
                });
                logger.info(`Success report sent to ${app.name} backend.`, prefix);
            } catch (repErr) {
                logger.warn(`Failed to send success report to ${app.name}: ${describeAxiosError(repErr)}`, prefix);
            }

            if (!globalConfig.keepLocalFile) {
                cleanupFiles([localFilePath, uploadFilePath]);
            }

            logger.info(`Backup cycle completed successfully.`, prefix);
        } catch (error) {
            logger.error(`Backup cycle failed: ${describeAxiosError(error)}`, prefix);

            if (!uploadSucceeded) {
                try {
                    await appClient.sendReport({
                        service: app.serviceName,
                        status: 'failed',
                        filename: metadata?.filename || null,
                        sha256: metadata?.sha256 || null,
                        error_message: describeAxiosError(error),
                        reported_at: timestamp(),
                        meta: {
                            type,
                            app: app.name,
                            storage_driver: storageDriver,
                        },
                    });
                    logger.info(`Failure report sent to ${app.name} backend.`, prefix);
                } catch (repErr) {
                    logger.warn(`Failed to send failure report to ${app.name}: ${describeAxiosError(repErr)}`, prefix);
                }
            }

            cleanupFiles([localFilePath, uploadFilePath]);
            throw error;
        }
    }

    async function runSingleCycle() {
        if (isCycleRunning) {
            logger.warn('Previous backup cycle is still running. Skipping this tick.');
            return;
        }

        isCycleRunning = true;
        logger.info(`Starting backup sweep across ${globalConfig.apps.length} application(s)...`);

        for (const app of globalConfig.apps) {
            for (const type of app.backupTypes) {
                try {
                    await processAppBackupType(app, type);
                } catch {
                    // Logged in processAppBackupType; continue to next app/type
                }
            }
        }

        logger.info('Backup sweep finished.');
        isCycleRunning = false;
    }

    async function start() {
        logger.info(`Universal Backup Puller Worker initialized.`);
        logger.info(`Default Storage Driver: ${globalConfig.storageDriver.toUpperCase()}`);
        logger.info(`Target Applications: ${globalConfig.apps.map((a) => `${a.name} (${a.storageDriver})`).join(', ')}`);
        logger.info(`Interval Mode: ${globalConfig.runIntervalMinutes} minute(s)`);

        if (globalConfig.runIntervalMinutes <= 0) {
            // One-off execution (Cron mode)
            await runSingleCycle();
            return;
        }

        // Daemon interval mode
        await runSingleCycle();
        const intervalMs = globalConfig.runIntervalMinutes * 60 * 1000;
        setInterval(runSingleCycle, intervalMs);
    }

    return {
        start,
        runSingleCycle,
    };
}

module.exports = {
    createRunner,
};
