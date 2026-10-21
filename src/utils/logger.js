'use strict';

function timestamp() {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '+07:00';
}

function maskSensitive(text) {
    if (typeof text !== 'string') {
        return text;
    }
    return text
        .replace(/([?&])(pwd|password|key|apiKey|token|secret)=([^&\s]+)/gi, '$1$2=***')
        .replace(/(Authorization:\s*(?:Bearer|Basic)\s+)[^\r\n]+/gi, '$1***')
        .replace(/("?(?:password|pwd|apiKey|token|secret)"?\s*:\s*)"[^"]+"/gi, '$1"***"');
}

function formatMessage(level, prefix, msg) {
    const p = prefix ? `[${prefix}] ` : '';
    const safeMsg = maskSensitive(msg);
    return `[${timestamp()}] [${level.toUpperCase()}] ${p}${safeMsg}`;
}

const logger = {
    info(msg, prefix = '') {
        console.log(formatMessage('info', prefix, msg));
    },
    warn(msg, prefix = '') {
        console.warn(formatMessage('warn', prefix, msg));
    },
    error(msg, prefix = '') {
        console.error(formatMessage('error', prefix, msg));
    },
    debug(msg, prefix = '') {
        if (process.env.DEBUG || process.env.LOG_LEVEL === 'debug') {
            console.log(formatMessage('debug', prefix, msg));
        }
    },
};

function describeAxiosError(error) {
    if (!error) {
        return 'Unknown error';
    }

    if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        let dataPreview = '';

        try {
            dataPreview = typeof error.response.data === 'string'
                ? error.response.data.slice(0, 300)
                : JSON.stringify(error.response.data).slice(0, 300);
        } catch {
            dataPreview = String(error.response.data);
        }

        const safePreview = maskSensitive(dataPreview);
        return `HTTP ${status} (${statusText}): ${safePreview}`;
    }

    if (error.request) {
        const safeMsg = maskSensitive(error.message);
        return `Network request failed: ${safeMsg} (code: ${error.code || 'UNKNOWN'})`;
    }

    return maskSensitive(error.message || String(error));
}

module.exports = {
    logger,
    describeAxiosError,
    maskSensitive,
    timestamp,
};