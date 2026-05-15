# SecureVault Portable Mode

## Database path resolution order

1. `SECUREVAULT_DB_PATH` environment variable
2. Portable mode (`--portable`, `SECUREVAULT_PORTABLE=1`, or `portable.flag` next to executable)
3. Default installed location (`AppData\\Local\\SecureVault\\vault.db`)

## Portable mode behavior

- In portable mode, the database is stored at:
  - `./data/vault.db` (relative to the executable directory)
- To force portable mode:
  - Run: `secure-vault.exe --portable`
  - Or set env: `SECUREVAULT_PORTABLE=1`
  - Or create empty file: `portable.flag` in the same folder as `secure-vault.exe`

## Build commands

- Installer build: `npm run tauri:build:installer`
- Portable binary build: `npm run tauri:build:portable`
- Full Windows release pipeline: `npm run release:win`
