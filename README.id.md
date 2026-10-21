# Universal Backup Puller Worker (`@putuwahyu29/backup-puller-worker`)

Microservice dan engine worker perantara universal untuk mengambil berkas backup (database & attachments) dari aplikasi web Laravel, memverifikasi integritas hash SHA-256, mengompresi ke ZIP, mengunggah ke **QNAP NAS (File Station CGI)** maupun **WebDAV (Nextcloud, ownCloud, Synology, Apache/Nginx WebDAV)**, melacak state deduplikasi, dan mengirimkan feedback report ke backend asal.

---

<p align="center">
  <a href="README.md">English</a> | <strong>Bahasa Indonesia</strong>
</p>

---

## 🌟 Fitur Utama

- **Dukungan Multi-Destination Storage**:
  - 🏢 **QNAP File Station CGI**: Login session SID otomatis (Base64), multipart streaming upload, auto-refresh session saat kedaluwarsa, mendukung firmware QTS & QuTS hero.
  - ☁️ **WebDAV / Nextcloud**: Mendukung Basic Auth & Bearer token, auto-create subfolder bertingkat (`MKCOL`), dan streaming upload binary (`PUT`). Cocok untuk Nextcloud, ownCloud, atau server WebDAV lainnya.
- **Single-App & Multi-App Fleet Mode**:
  - *Single-App Mode*: Konfigurasi via file `.env` untuk mem-backup 1 aplikasi.
  - *Multi-App Fleet Mode*: Cukup definisikan daftar aplikasi di `config/apps.json`, 1 worker container dapat mem-backup 5, 10, atau puluhan aplikasi sekaligus ke tujuan storage yang berbeda-beda!
- **Integritas & Keamanan**:
  - Verifikasi checksum SHA-256 streaming sebelum file diunggah.
  - Kompresi ZIP otomatis (kecuali berkas yang sudah terkompresi seperti `.zip` atau `.gz`).
  - Pembersihan berkas temporer lokal setelah upload selesai (*zero disk clutter*).
- **Kebijakan Sinkronisasi (Sync Policies)**:
  - `dedupe`: Lewati jika hash SHA-256 identik dengan backup sebelumnya.
  - `daily`: Maksimal 1 backup sukses per hari (berdasarkan timezone `Asia/Jakarta`).
  - `force`: Selalu upload ulang.
- **Audit Feedback Loop**:
  - Melaporkan status sukses maupun gagal (beserta error detail dan tipe storage) ke endpoint `POST /api/service-reports` pada aplikasi asal.
- **Container Ready & GHCR**: Multi-architecture Docker image (`linux/amd64`, `linux/arm64`) otomatis dirilis via GitHub Container Registry.

---

## ⚙️ Pilihan Driver Storage Tujuan

Anda dapat menentukan tujuan penyimpanan baik secara global di `.env` atau per aplikasi di `apps.json`:

### Opsi A: QNAP NAS File Station
```env
STORAGE_DRIVER=qnap
QNAP_HOST=http://qnap.local:8080
QNAP_USERNAME=admin
QNAP_PASSWORD=password-qnap-anda
QNAP_DEST_PATH=/home/backup/kadiri
```

### Opsi B: WebDAV / Nextcloud
```env
STORAGE_DRIVER=webdav
# Contoh Nextcloud: https://cloud.domain.com/remote.php/dav/files/admin
# Contoh WebDAV NAS / Apache: http://nas.local:5005/webdav
WEBDAV_URL=https://cloud.domain.com/remote.php/dav/files/admin
WEBDAV_USERNAME=admin
WEBDAV_PASSWORD=app-password
WEBDAV_DEST_PATH=/backup/kadiri
WEBDAV_AUTH_TYPE=basic
```

---

## 🚀 Panduan Penggunaan

### 1. Mode Standalone / Local Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env sesuai target aplikasi & storage tujuan (QNAP / WebDAV)

# Jalankan 1 kali eksekusi (test)
npm run once

# Jalankan daemon looping (sesuai RUN_INTERVAL_MINUTES)
npm start
```

### 2. Mode Multi-App Fleet (1 Container untuk Banyak Aplikasi)

Anda dapat mencampur tujuan storage antar aplikasi! Misalnya: App A ke QNAP, App B ke Nextcloud WebDAV:

1. Buat file `config/apps.json`:
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
2. Di `.env`, tambahkan:
   ```env
   APPS_CONFIG_PATH=./config/apps.json
   ```
3. Jalankan `npm start`. Worker akan melakukan loop untuk mem-backup setiap aplikasi yang terdaftar ke tujuan storage masing-masing.

---

## 🐳 Rilis Otomatis & Distribusi Docker Image (GHCR)

Repository ini telah dilengkapi dengan workflow CI/CD GitHub Actions ([.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml)). Setiap kali Anda melakukan push ke branch `main` atau membuat release tag (contoh: `v1.0.0`), Docker image akan otomatis di-build (multi-arch: `linux/amd64`, `linux/arm64`) dan di-publish ke **GitHub Container Registry (GHCR)**.

### 1. Menarik Image Langsung dari GitHub
```bash
docker pull ghcr.io/putuwahyu29/backup-puller-worker:latest
```

### 2. Deploy di Server Produksi Menggunakan Docker Compose
Pada server target, Anda tidak perlu meng-clone source code. Cukup buat file `docker-compose.yml`:

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

Lalu jalankan:
```bash
docker compose up -d
```

Melihat log:
```bash
docker compose logs -f
```

---

## 📄 Lisensi

Paket ini dirilis di bawah lisensi terbuka [MIT License](LICENSE).  
Dikembangkan oleh **Putu Wahyu & Kontributor**.