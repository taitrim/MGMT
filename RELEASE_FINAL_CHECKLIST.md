# RELEASE_FINAL_CHECKLIST

Ngay kiem tra: 2026-05-17

## 1) Build va dong goi
- [PASS] Frontend production build: `npm.cmd run build`
- [PASS] Backend compile check: `cargo check`
- [PASS] Portable build: `npm.cmd run tauri:build:portable`
  - Artifact: `src-tauri/target/x86_64-pc-windows-msvc/release/secure-vault.exe`

## 2) Bao mat va phan quyen
- [PASS] Re-auth xem password da kiem tra lai dung mat khau user/master
- [PASS] Re-auth co brute-force protection (khoa tam thoi)
- [PASS] Co audit event cho re-auth (success/failed/blocked)
- [PASS] Role gate owner/admin cho khu vuc nhay cam

## 3) Backup / Restore
- [PASS] Backup versioned + retention (`export_vault_versioned`)
- [PASS] UI Backup nhanh trong App Settings
- [PASS] UI Restore co dry-run verify truoc khi restore
- [PASS] Hien ket qua checksum/sqlite validity truoc restore

## 4) UI/UX
- [PASS] Theme sang/to va bo mau da dong bo
- [PASS] Card/list/dashboard duoc nang cap visual (surface/chip/shadow)
- [PASS] Bo loc nang cao: tag, nguoi cap nhat, trang thai thoi han
- [PASS] Skeleton loading + transition category/filter/view mode
- [PASS] Sua loi tieng Viet o cac man chinh vua nang cap

## 5) Do on dinh van hanh
- [PASS] DB health check hien thi trong Settings
- [PASS] Canh bao khi DB issue
- [PASS] Co huong dan build/test trong tai lieu

## 6) Viec nen lam tiep (khong blocker)
- [TODO] Them test tu dong backend/frontend (permission matrix, restore flow)
- [TODO] Chuan hoa toan bo alert/confirm sang modal/toast
- [TODO] Bo sung tai lieu User/Admin guide chi tiet
- [TODO] Ky so installer neu phat hanh ngoai noi bo

## Ket luan
Ung dung da dat muc **san sang su dung thuc te** cho moi truong noi bo/doi van hanh.
Co the phat hanh portable ngay sau khi test nghiem thu 1 vong theo checklist tren.
