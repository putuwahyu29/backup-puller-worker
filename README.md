# Universal Backup Puller Worker (`@putuwahyu29/backup-puller-worker`)

A universal microservice and worker daemon to fetch database dumps and attachment archives from Laravel applications, verify streaming SHA-256 integrity, compress to ZIP, upload to **QNAP NAS (File Station CGI)** or **WebDAV (Nextcloud, ownCloud, Synology, Apache/Nginx WebDAV)**, track deduplication state, and send round-trip audit confirmation callbacks.

---

<p align="center">
  <strong>English</strong> | <a href="README.id.md">Bahasa Indonesia</a>
</p>

---

## 🌟 Key Features

- **Multi-Destination Storage Support**:
  - 🏢 **QNAP File Station CGI**: Base64 session SID authentication, multipart streaming upload, auto-refresh on session expiration, supports QTS & QuTS hero.
  - ☁️ **WebDAV / Nextcloud**: Supports Basic Auth & Bearer token, multi-level folder creation (`MKCOL`), and streaming binary upload (`PUT`).
- **Single-App & Multi-App Fleet Mode**:
  - *Single-App Mode*: Managed simply via `.env`.
  - *Multi-App Fleet Mode*: Define all your applications in `config/apps.json`. A single worker container can pull from 5, 10, or dozens of Laravel apps and route them to different storage targets!
- **Hardened Integrity & Clean Up**:
  - Validates streaming SHA-256 checksums before initiating upload.
  - Automatic ZIP compression (excluding already compressed files like `.zip` or `.gz`).
  - Automatic temporary file cleanup (*zero disk clutter*).
- **Flexible Sync Policies**:
  - `dedupe`: Skips upload if the remote SHA-256 matches previous records.
  - `daily`: Ensures maximum 1 successful backup per day (timezone `Asia/Jakarta`).
  - `force`: Always re-uploads.
- **Round-Trip Audit Feedback**:
  - Posts execution status and error logs back to the origin app (`POST /api/service-reports`).
- **Container Ready & GHCR**: Multi-architecture Docker image (`linux/amd64`, `linux/arm64`) automatically published to GitHub Container Registry.

---

## ⚙️ Storage Driver Configuration

Configure your storage targets globally in `.env` or per-app in `apps.json`:

### Option A: QNAP NAS File Station
```env
STORAGE_DRIVER=qnap
QNAP_HOST=http://qnap.local:8080
QNAP_USERNAME=admin
QNAP_PASSWORD=your-qnap-password
QNAP_DEST_PATH=/home/backup/kadiri
```

### Option B: WebDAV / Nextcloud
```env
STORAGE_DRIVER=webdav
# Nextcloud: https://cloud.domain.com/remote.php/dav/files/admin
# WebDAV NAS / Apache: http://nas.local:5005/webdav
WEBDAV_URL=https://cloud.domain.com/remote.php/dav/files/admin
WEBDAV_USERNAME=admin
WEBDAV_PASSWORD=app-password
WEBDAV_DEST_PATH=/backup/kadiri
WEBDAV_AUTH_TYPE=basic
```

---

## 🚀 Quick Start Guide

### 1. Standalone / Local Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env for your target application and storage

# Run a single test run
npm run once

# Start the continuous looping daemon
npm start
```

### 2. Multi-App Fleet Mode (1 Worker for Multiple Applications)

Route backups from different Laravel applications to different storage backends:

1. Create `config/apps.json`:
   ```json
   [
     {
       "name": "kadiri",
       "serviceName": "backup-puller-kadiri",
       "apiBaseUrl": "https://kadiri.domain.com",
       "apiKey": "bk_secure_api_key_kadiri",
       "backupTypes": ["database"],
       "storage": "qnap",
       "qnapDestPath": "/home/backup/kadiri",
       "uploadPolicy": "dedupe"
     },
     {
       "name": "panjalu",
       "serviceName": "backup-puller-panjalu",
       "apiBaseUrl": "https://panjalu.domain.com",
       "apiKey": "bk_secure_api_key_panjalu",
       "backupTypes": ["database", "attachments"],
       "storage": "webdav",
       "webdavUrl": "https://cloud.domain.com/remote.php/dav/files/admin",
       "webdavUsername": "admin",
       "webdavPassword": "nextcloud-app-password",
       "webdavDestPath": "/backup/panjalu",
       "uploadPolicy": "daily"
     }
   ]
   ```
2. In `.env`, add:
   ```env
   APPS_CONFIG_PATH=./config/apps.json
   ```
3. Run `npm start`.

---

## 🐳 Automated Releases & Docker Image Distribution (GHCR)

This repository includes a pre-configured GitHub Actions CI/CD workflow ([.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml)). Whenever you push to the `main` branch or create a version tag (e.g., `v1.0.0`), a multi-architecture Docker image (`linux/amd64`, `linux/arm64`) is automatically built and pushed to **GitHub Container Registry (GHCR)**.

### 1. Pulling the Image
```bash
docker pull ghcr.io/putuwahyu29/backup-puller-worker:latest
```

### 2. Production Deployment with Docker Compose
On your production node, you don't need to clone the source code. Simply create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backup-worker:
    image: ghcr.io/putuwahyu29/backup-puller-worker:latest
    container_name: backup-worker
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./runtime:/app/runtime
      - ./config/apps.json:/app/config/apps.json:ro
```

Then start the container:
```bash
docker compose up -d
```

View real-time logs:
```bash
docker compose logs -f
```

---

## 📄 License

The MIT License (MIT). Please see [License File](LICENSE) for more information.  
Maintained by **Putu Wahyu & Contributors**.