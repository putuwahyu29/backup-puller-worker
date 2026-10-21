'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { StateStore } = require('../src/state/stateStore');

test('StateStore evaluateSkip dedupe skips when sha256 matches', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
    const store = new StateStore(tempDir);

    const decision1 = store.evaluateSkip({
        policy: 'dedupe',
        state: { lastSha256: 'abc123hash' },
        metadata: { sha256: 'abc123hash', filename: 'database.sql' },
    });
    assert.strictEqual(decision1.skip, true);

    const decision2 = store.evaluateSkip({
        policy: 'dedupe',
        state: { lastSha256: 'abc123hash' },
        metadata: { sha256: 'different_hash_456', filename: 'database.sql' },
    });
    assert.strictEqual(decision2.skip, false);

    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('StateStore forceUpload overrides skip decision', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
    const store = new StateStore(tempDir);

    const decision = store.evaluateSkip({
        policy: 'dedupe',
        forceUpload: true,
        state: { lastSha256: 'abc123hash' },
        metadata: { sha256: 'abc123hash', filename: 'database.sql' },
    });
    assert.strictEqual(decision.skip, false);

    fs.rmSync(tempDir, { recursive: true, force: true });
});