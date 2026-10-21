'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    parseQnapResponse,
    isQnapSuccess,
    qnapUploadedInfo,
    qnapStatusValue,
} = require('../src/storage/qnapResponse');

test('parseQnapResponse correctly parses XML responses from QNAP CGI', () => {
    const xml = '<QDocRoot><authPassed>1</authPassed><authSid>sid_abc123xyz</authSid></QDocRoot>';
    const parsed = parseQnapResponse(xml);
    assert.strictEqual(parsed.QDocRoot.authPassed, 1);
    assert.strictEqual(parsed.QDocRoot.authSid, 'sid_abc123xyz');
});

test('parseQnapResponse correctly parses JSON responses', () => {
    const json = '{"status": 1, "success": true, "filename": "database.sql"}';
    const parsed = parseQnapResponse(json);
    assert.strictEqual(parsed.status, 1);
    assert.strictEqual(parsed.success, true);
});

test('isQnapSuccess identifies success across diverse response schemas', () => {
    assert.strictEqual(isQnapSuccess({ status: 1 }), true);
    assert.strictEqual(isQnapSuccess({ status: '1' }), true);
    assert.strictEqual(isQnapSuccess({ success: true }), true);
    assert.strictEqual(isQnapSuccess({ QDocRoot: { status: 1 } }), true);
    assert.strictEqual(isQnapSuccess({ status: 0 }), false);
    assert.strictEqual(isQnapSuccess({ error: 'Auth failed' }), false);
});

test('qnapUploadedInfo extracts file metadata correctly', () => {
    const data = {
        name: 'database-panjalu.sql.zip',
        size: 2048576,
    };
    const info = qnapUploadedInfo(data, 'database-panjalu.sql.zip', 2048576);
    assert.strictEqual(info.name, 'database-panjalu.sql.zip');
    assert.strictEqual(info.size, 2048576);
});