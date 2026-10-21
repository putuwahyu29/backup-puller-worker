'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { maskSensitive, describeAxiosError } = require('../src/utils/logger');

test('maskSensitive masks credentials in query params and json', () => {
    const url = 'https://nas.local:8080/cgi-bin/authLogin.cgi?user=admin&pwd=secretPassword123';
    const masked = maskSensitive(url);
    assert.strictEqual(masked.includes('secretPassword123'), false);
    assert.strictEqual(masked.includes('pwd=***'), true);

    const json = '{"apiKey": "super-secret-key-999", "name": "panjalu"}';
    const maskedJson = maskSensitive(json);
    assert.strictEqual(maskedJson.includes('super-secret-key-999'), false);
    assert.strictEqual(maskedJson.includes('"apiKey": "***"'), true);
});

test('describeAxiosError handles null or generic error safely', () => {
    assert.strictEqual(describeAxiosError(null), 'Unknown error');
    assert.strictEqual(describeAxiosError(new Error('Connection timed out')), 'Connection timed out');
});

test('describeAxiosError masks secrets in response error', () => {
    const error = {
        response: {
            status: 401,
            statusText: 'Unauthorized',
            data: { error: 'invalid token', token: 'secret-token-abc' }
        }
    };
    const desc = describeAxiosError(error);
    assert.strictEqual(desc.includes('secret-token-abc'), false);
    assert.strictEqual(desc.includes('HTTP 401 (Unauthorized)'), true);
});