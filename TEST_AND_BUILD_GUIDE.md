# SecureVault - Huong dan Test va Build

## 1) Yeu cau moi truong

- Windows 10/11
- Node.js 20+ (khuyen nghi LTS)
- Rust toolchain (stable) + Cargo
- Visual Studio Build Tools (Desktop development with C++)
- WebView2 Runtime

Kiem tra nhanh:

```powershell
node -v
npm -v
rustc -V
cargo -V
```

Neu PowerShell chan script `npm.ps1`, dung `npm.cmd` thay cho `npm`.

## 2) Cai dependency

```powershell
npm.cmd install
```

## 3) Chay ung dung de dev/test

Chay frontend:

```powershell
npm.cmd run dev
```

Chay full desktop app (Tauri):

```powershell
npm.cmd run tauri:dev
```

## 4) Checklist test thu cong

1. Dang nhap/Unlock vault thanh cong.
2. Tao account type moi, them nhieu field, luu thanh cong.
3. Tao account moi theo account type vua tao.
4. Vao `Mau truong tai khoan`, xoa 1 field dang co du lieu:
   - Phai hien canh bao xac nhan.
5. Dung nut `Duplicate` de nhan ban account type.
6. Vao menu `My Accounts / Tai khoan cua toi`:
   - Chi hien account khong gan customer.
7. Kiem tra mau icon tung loai account:
   - Moi loai co mau khac nhau ro rang.
8. Vao `App Settings`:
   - Xem mode `portable/installed`
   - Open data folder hoat dong.

## 5) Build frontend + kiem tra Rust

```powershell
npm.cmd run build
cd src-tauri
cargo check
cargo test
cd ..
```

## 6) Build ban cai dat (Installer)

```powershell
npm.cmd run tauri:build:installer
```

Output thuong nam trong:

- `src-tauri\target\release\bundle\nsis\`
- `src-tauri\target\release\bundle\msi\`

## 7) Build ban Portable

```powershell
npm.cmd run tauri:build:portable
```

Ban portable co the dung `.exe` trong:

- `src-tauri\target\release\`

De chay portable mode:

1. Chay `secure-vault.exe --portable`
2. Hoac dat env `SECUREVAULT_PORTABLE=1`
3. Hoac tao file rong `portable.flag` cung thu muc voi `.exe`

Khi portable mode, DB mac dinh:

- `.\data\vault.db` (cung thu muc app)

## 8) Build full release cho Windows

```powershell
npm.cmd run release:win
```

Lenh nay build ca installer va portable.

## 9) Loi thuong gap

1. Loi `npm.ps1 cannot be loaded`:
   - Dung `npm.cmd ...` thay `npm ...`
2. Loi thieu C++ build tools:
   - Cai Visual Studio Build Tools + workload C++
3. Loi build Rust do lock file:
   - Dong process build cu, chay lai.
4. App khong mo:
   - Thu `npm.cmd run tauri:dev` de xem log.

## 10) CI/CD (GitHub Actions)

Workflow: `.github/workflows/ci-release.yml`

- Khi `push` / `pull_request` vao `main`:
  - Chay `npm ci`
  - Chay `npm run build`
  - Chay `cargo check`
  - Chay `cargo test`

- Khi push tag `v*` (vi du: `v1.0.1`):
  - Chay full validate
  - Build Windows installer + portable
  - Upload artifacts:
    - `windows-nsis`
    - `windows-msi`
    - `windows-portable-exe`

Lenh tao tag va trigger release build:

```powershell
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

## 11) Final Release Checklist (2026-05-17)

Da kiem tra pass:

- `npm.cmd run build`
- `cargo check`
- `npm.cmd run tauri:build:portable`
  - Artifact: `src-tauri/target/x86_64-pc-windows-msvc/release/secure-vault.exe`

Bao mat/phan quyen:
- Re-auth xem password xac thuc dung mat khau user/master
- Co brute-force protection cho re-auth
- Co audit log cho re-auth success/failed/blocked

Backup/Restore:
- Backup versioned + retention
- UI Backup nhanh trong App Settings
- UI Restore co dry-run verify truoc restore

UI/UX:
- Da nang cap visual card/dashboard/filter
- Co skeleton loading + transition category/filter/view mode
- Da sua cac loi tieng Viet o cac man vua nang cap

File checklist chi tiet:
- `RELEASE_FINAL_CHECKLIST.md`
