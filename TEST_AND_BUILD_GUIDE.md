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
