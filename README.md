# SecureVault (MGMT)

SecureVault is a desktop password manager built with **Tauri + React + Rust + SQLite**.

It is designed for:
- personal account management
- customer account management
- infrastructure credentials (server, network, VPN, email admin, API keys, etc.)

## Key Features

- Local-first vault (desktop app)
- Master password authentication
- AES-based field encryption for sensitive data
- Metadata hardening for sensitive fields
- Account templates (custom fields per account type)
- Expiration date support with warning indicators
- TOTP support
- Attachment support
- Audit log
- Portable mode and installer mode

## Tech Stack

- Frontend: React + TypeScript + Zustand + Tailwind
- Desktop runtime: Tauri v2
- Backend: Rust
- Storage: SQLite

## Quick Start

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

## Build

- Installer:

```powershell
npm.cmd run tauri:build:installer
```

- Portable binary:

```powershell
npm.cmd run tauri:build:portable
```

- Full Windows release build:

```powershell
npm.cmd run release:win
```

## Test

```powershell
npm.cmd run build
cd src-tauri
cargo test
cd ..
```

## Docs

- [TEST_AND_BUILD_GUIDE.md](./TEST_AND_BUILD_GUIDE.md)
- [PORTABLE.md](./PORTABLE.md)

## Security Notes

- Master password is required to unlock vault content.
- Sensitive fields are encrypted before storage.
- Never commit real vault databases or backup files into Git.

## License

MIT

