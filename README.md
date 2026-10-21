# Universal Backup Puller Worker (`@putuwahyu29/backup-puller-worker`)

A lightweight, standalone microservice and worker engine designed to pull backup archives (database dumps & attachments) from remote Laravel applications, verify streaming SHA-256 checksums, compress into ZIP archives, upload to **QNAP NAS (File Station CGI)** or **WebDAV (Nextcloud, ownCloud, Synology, Apache/Nginx WebDAV)**, track sync deduplication state, and send audit confirmation reports back to host applications.

---

<p align="center">
  <strong>English</strong> | <a href="README.id.md">Bahasa Indonesia</a>
</p>

---

## ðŸŒŸ Key Features

- **Multi-Destination Storage Adapters**:
  - ðŸ¢ **QNAP File Station CGI**: Automated Base64 session SID authentication, multipart streaming upload, auto-refresh on session expiration, compatible with QTS & QuTS hero firmware.
  - â˜ï¸ **WebDAV / Nextcloud**: Supports HTTP Basic & Bearer authentication, recursive directory creation (`MKCOL`), and streaming binary uploads (`PUT`). Fully compatible with Nextcloud, ownCloud, and any WebDAV-compliant server.
- **Single-App & Multi-App Fleet Mode**:
  - *Single-App Mode*: Minimal setup via `.env` to backup an individual application.
  - *Multi-App Fleet Mode*: Define all applications in `config/apps.json`. A single worker container orchestrates backups across dozens of Laravel apps, directing each app to its own target storage protocol and directory.
- **Data Integrity & Automation**:
  - Streaming SHA-256 checksum validation prior to upload.
  - Automatic on-the-fly ZIP compression (skips already compressed `.zip` or `.gz` files).
  - Immediate local scratch cleanup upon successful upload (*zero disk clutter*).
- **Flexible Synchronization Policies**:
  - `dedupe`: Skips upload if the remote SHA-256 checksum matches the previous successful backup.
  - `daily`: Restricts uploads to a maximum of one successful backup per calendar day.
  - `force`: Always downloads and re-uploads regardless of state history.
- **Round-Trip Audit Feedback Loop**:
  - Posts execution results (`success` / `failed`), uploaded size, and detailed error messages to the host app's `POST /api/service-reports` endpoint.
- **Container-First Architecture**: Includes production-ready `Dockerfile` and `docker-compose.yml`.

---

## âš™ï¸ Target Storage Configuration

You can configure storage destinations globally in `.env` or individually per application in `apps.json`:

### Option A: QNAP NAS File Station
```env
STORAGE_DRIVER=qnap
QNAP_HOST=http://qnap.local:8080
QNAP_USERNAME=admin
QNAP_PASSWORD=your-qnap-password
QNAP_DEST_PATH=/home/backup/my-app
```

### Option B: WebDAV / Nextcloud
```env
STORAGE_DRIVER=webdav
# Nextcloud: https://cloud.example.com/remote.php/dav/files/admin
# Standard WebDAV: http://nas.local:5005/webdav
WEBDAV_URL=https://cloud.example.com/remote.php/dav/files/admin
WEBDAV_USERNAME=admin
WEBDAV_PASSWORD=your-app-password
WEBDAV_DEST_PATH=/backup/my-app
WEBDAV_AUTH_TYPE=basic
```

---

## ðŸš€ Usage Guide

### 1. Standalone / Local Development

```bash
cd packages/backup-puller-worker

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your target application URL & storage credentials

# Execute a single backup run (test)
npm run once

# Start the continuous worker daemon
npm start
```

### 2. Multi-App Fleet Mode (One Worker for All Applications)

You can mix and match storage destinations per application. For instance, route App A to QNAP and App B to Nextcloud:

1. Create `config/apps.json`:
   ```json
   [
     {
       "name": "billing-app",
       "serviceName": "backup-puller-billing",
       "apiBaseUrl": "https://billing.example.com",
       "apiKey": "bk_secure_api_key_billing",
       "backupTypes": ["database"],
       "storage": "qnap",
       "qnapDestPath": "/home/backup/billing",
       "uploadPolicy": "dedupe"
     },
     {
       "name": "portal-app",
       "serviceName": "backup-puller-portal",
       "apiBaseUrl": "https://portal.example.com",
       "apiKey": "bk_secure_api_key_portal",
       "backupTypes": ["database", "attachments"],
       "storage": "webdav",
       "webdavUrl": "https://cloud.example.com/remote.php/dav/files/admin",
       "webdavUsername": "admin",
       "webdavPassword": "nextcloud-app-password",
       "webdavDestPath": "/backup/portal",
       "uploadPolicy": "daily"
     }
   ]
   ```
2. In `.env`, set:
   ```env
   APPS_CONFIG_PATH=./config/apps.json
   ```
3. Run `npm start`. The worker will cycle through each application, pulling backups and routing them to their respective storage destinations.

### 3. Deploy via Docker Compose

```bash
docker compose up -d --build
```

View live logs:
```bash
docker compose logs -f
```

---

## ðŸ³ Docker Image Distribution

To distribute this worker across your server infrastructure without rebuilding source code on each node:

1. **Build and Tag the Docker Image**:
   ```bash
   docker build -t putuwahyu29/backup-puller-worker:v1.0.0 .
   ```

2. **Push to Container Registry**:
   ```bash
   docker push putuwahyu29/backup-puller-worker:v1.0.0
   ```

3. **Deploy on Remote Nodes**:
   Create a standard `docker-compose.yml` on the target host:
   ```yaml
   version: '3.8'
   services:
     backup-worker:
       image: putuwahyu29/backup-puller-worker:v1.0.0
       restart: unless-stopped
       env_file: .env
       volumes:
         - ./runtime:/app/runtime
         - ./apps.json:/app/config/apps.json:ro
   ```
   Execute `docker compose up -d`.

---

## ðŸ“„ License

The MIT License (MIT). Please see [License File](LICENSE) for more information.
Maintained by **Putu Wahyu & Contributors**.