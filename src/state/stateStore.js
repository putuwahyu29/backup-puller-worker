'use strict';

const fs = require('fs');
const path = require('path');
const { ensureDir } = require('../utils/fileOps');
const { logger } = require('../utils/logger');

class StateStore {
    constructor(stateDir = './runtime/state') {
        this.stateDir = path.resolve(process.cwd(), stateDir);
        ensureDir(this.stateDir);
    }

    statePath(appName, type = 'database') {
        const safeApp = appName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeType = type.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.stateDir, `${safeApp}-${safeType}.json`);
    }

    load(appName, type = 'database') {
        const file = this.statePath(appName, type);
        if (!fs.existsSync(file)) {
            return {};
        }

        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            logger.warn(`Corrupt state file for ${appName}/${type}, resetting state.`, appName);
            return {};
        }
    }

    save(appName, type = 'database', data = {}) {
        const file = this.statePath(appName, type);
        ensureDir(path.dirname(file));

        const existing = this.load(appName, type);
        const updated = {
            ...existing,
            ...data,
            last_updated: new Date().toISOString(),
        };

        fs.writeFileSync(file, JSON.stringify(updated, null, 2), 'utf8');
    }

    evaluateSkip({ policy, timezone, forceUpload, state, metadata }) {
        if (forceUpload) {
            return { skip: false };
        }

        const effectivePolicy = (policy || 'dedupe').toLowerCase();

        if (effectivePolicy === 'daily') {
            const todayKey = this.getDateKey(new Date(), timezone || 'Asia/Jakarta');
            const lastDaily = state.last_daily_key || state.lastDailyKey;
            if (lastDaily === todayKey) {
                return {
                    skip: true,
                    message: `Skip: daily backup for ${todayKey} already uploaded.`,
                };
            }
            return { skip: false, dailyKey: todayKey };
        }

        // Dedupe policy (compare SHA-256)
        const lastHash = state.last_sha256 || state.lastSha256;
        if (lastHash && metadata?.sha256 && lastHash.toLowerCase() === metadata.sha256.toLowerCase()) {
            return {
                skip: true,
                message: `Skip: file checksum identical to previous upload (${metadata.filename}).`,
            };
        }

        return { skip: false };
    }

    getDateKey(date, timeZone) {
        try {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(date);
            return parts;
        } catch {
            return date.toISOString().slice(0, 10);
        }
    }
}

module.exports = {
    StateStore,
};