# Release Checklist (Windows)

## 1) Pre-release Validation

- [ ] Pull latest code and confirm branch is correct (`main`)
- [ ] Run frontend build:
  - `npm.cmd run build`
- [ ] Run Rust checks/tests:
  - `cd src-tauri`
  - `cargo check`
  - `cargo test`
  - `cd ..`
- [ ] Confirm no sensitive files are staged (`.db`, `.env`, backups)

## 2) Versioning

- [ ] Update version in:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
- [ ] Commit version bump
- [ ] Tag release:
  - `git tag vX.Y.Z`
  - `git push origin vX.Y.Z`

## 3) Build Artifacts

- [ ] Build installer artifacts:
  - `npm.cmd run tauri:build:installer`
- [ ] Build portable artifact:
  - `npm.cmd run tauri:build:portable`
- [ ] Verify outputs:
  - Installer: `src-tauri\target\release\bundle\nsis\` / `msi\`
  - Portable exe: `src-tauri\target\release\secure-vault.exe`

## 4) Smoke Test

- [ ] Fresh install test (installer)
- [ ] Portable mode test (`portable.flag` or `--portable`)
- [ ] Unlock flow and master password validation
- [ ] Create/edit/delete account
- [ ] Search (name + metadata + fields)
- [ ] Expiry warning badges
- [ ] Import dry-run + import confirm flow
- [ ] DB health check status

## 5) Publish

- [ ] Push final code to GitHub
- [ ] Create GitHub Release `vX.Y.Z`
- [ ] Upload artifacts:
  - NSIS installer
  - MSI package
  - Portable `.exe`
- [ ] Add release notes:
  - features
  - fixes
  - known issues

## 6) Post-release

- [ ] Verify download links
- [ ] Verify installer launch on clean machine
- [ ] Verify portable launch from non-dev path
- [ ] Create follow-up issues for known limitations

