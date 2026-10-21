'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WebdavClient } = require('../src/storage/webdavClient');

test('WebdavClient formats basic auth header properly', () => {
    const client = new WebdavClient({
        url: 'https://cloud.bps.go.id/remote.php/dav/files/admin',
        username: 'bps_user',
        password: 'secure_password',
        authType: 'basic',
    }, null);

    const headers = client.getHeaders();
    assert.ok(headers.Authorization);
    assert.ok(headers.Authorization.startsWith('Basic '));

    const token = headers.Authorization.replace('Basic ', '');
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    assert.strictEqual(decoded, 'bps_user:secure_password');
});

test('WebdavClient formats bearer token properly', () => {
    const client = new WebdavClient({
        url: 'https://cloud.bps.go.id',
        password: 'bearer_token_xyz',
        authType: 'bearer',
    }, null);

    const headers = client.getHeaders();
    assert.strictEqual(headers.Authorization, 'Bearer bearer_token_xyz');
});

test('WebdavClient normalizes collection and endpoint URLs without redundant slashes', () => {
    const client = new WebdavClient({
        url: 'https://cloud.bps.go.id/dav///',
    }, null);

    const url1 = client.normalizeUrl('https://cloud.bps.go.id/dav///', '///backup/panjalu///');
    assert.strictEqual(url1, 'https://cloud.bps.go.id/dav/backup/panjalu');

    const url2 = client.normalizeUrl('https://cloud.bps.go.id/dav', '');
    assert.strictEqual(url2, 'https://cloud.bps.go.id/dav');
});