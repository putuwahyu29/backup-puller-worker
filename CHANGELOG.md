# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-20

### Added
- Universal HTTP client to pull metadata and stream binary backups from Laravel applications.
- Multi-App Fleet Mode via `apps.json`: 1 container can backup multiple applications in sequence.
- QNAP File Station CGI client with base64 auth, SID session management, and auto-retry.
- Streamed SHA-256 integrity verification before uploading to destination.
- Streaming ZIP compression for uncompressed SQL dumps with configurable compression levels.
- Deduplication and daily upload sync policies.
- Audit callback feedback loop (`POST /api/service-reports`).
- Docker containerization and Docker Compose setup.
