'use strict';

const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
});

function parseQnapResponse(data) {
    if (!data) {
        return {};
    }

    if (typeof data === 'object') {
        return data;
    }

    if (typeof data !== 'string') {
        return { raw: String(data) };
    }

    const trimmed = data.trim();

    // 1. Try JSON parse
    try {
        return JSON.parse(trimmed);
    } catch {
        // Not JSON
    }

    // 2. Try XML parse
    try {
        const parsed = xmlParser.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    } catch {
        // Not XML
    }

    return { raw: trimmed };
}

function readPathValue(source, pathKey) {
    return pathKey.split('.').reduce((current, key) => {
        if (current === null || current === undefined) {
            return undefined;
        }
        return current[key];
    }, source);
}

function firstDefinedValue(source, pathKeys) {
    for (const pathKey of pathKeys) {
        const value = readPathValue(source, pathKey);
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return null;
}

function qnapStatusValue(parsed) {
    return firstDefinedValue(parsed, [
        'status',
        'statusValue',
        'QDocRoot.status',
        'Result.status',
        'data.status',
        'status_code',
        'success',
        'authPassed',
    ]);
}

function isQnapSuccess(parsed) {
    const status = qnapStatusValue(parsed);
    return String(status) === '1' || status === true || status === 1;
}

function qnapUploadedInfo(parsed, fallbackName, fallbackSize) {
    const name = firstDefinedValue(parsed, [
        'name',
        'filename',
        'fname',
        'upload_name',
        'upload_filename',
        'file.name',
        'file.filename',
        'files.0.name',
        'files.0.filename',
        'QDocRoot.name',
        'QDocRoot.filename',
        'Result.name',
        'Result.filename',
    ]) || fallbackName;

    const sizeRaw = firstDefinedValue(parsed, [
        'size',
        'filesize',
        'file_size',
        'upload_size',
        'file.size',
        'files.0.size',
        'QDocRoot.size',
        'Result.size',
    ]);

    const sizeParsed = Number(sizeRaw);
    const size = Number.isFinite(sizeParsed) ? sizeParsed : fallbackSize;

    return { name, size };
}

function qnapResponsePreview(parsed) {
    try {
        const str = typeof parsed === 'object' ? JSON.stringify(parsed) : String(parsed);
        return str.length > 250 ? str.slice(0, 250) + '...' : str;
    } catch {
        return '[Unserializable response]';
    }
}

module.exports = {
    parseQnapResponse,
    qnapStatusValue,
    isQnapSuccess,
    qnapUploadedInfo,
    qnapResponsePreview,
};