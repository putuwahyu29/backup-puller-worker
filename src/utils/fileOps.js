'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

async function verifyChecksum(filePath, expectedSha256) {
    const actualSha = await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });

    if (actualSha.toLowerCase() !== expectedSha256.toLowerCase()) {
        throw new Error(
            `Checksum mismatch! Expected SHA-256: ${expectedSha256}, Actual: ${actualSha}`
        );
    }

    return actualSha;
}

async function createZipArchive(sourceFilePath, entryName, destZipPath, compressionLevel = 9) {
    ensureDir(path.dirname(destZipPath));

    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(destZipPath);
        const archive = archiver('zip', {
            zlib: { level: Number(compressionLevel) || 9 },
        });

        output.on('close', () => {
            try {
                fs.chmodSync(destZipPath, 0o666);
            } catch {
                // Ignore permission error on Windows
            }
            resolve({
                destZipPath,
                totalBytes: archive.pointer(),
            });
        });

        output.on('error', reject);
        archive.on('error', reject);

        archive.pipe(output);
        archive.file(sourceFilePath, { name: entryName });
        archive.finalize();
    });
}

function cleanupFiles(paths) {
    const targets = new Set(paths.filter(Boolean));
    for (const target of targets) {
        try {
            if (fs.existsSync(target)) {
                fs.unlinkSync(target);
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}

module.exports = {
    ensureDir,
    verifyChecksum,
    createZipArchive,
    cleanupFiles,
};
