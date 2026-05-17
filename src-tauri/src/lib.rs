use std::sync::Arc;
use tauri::{Emitter, Manager};
use directories::ProjectDirs;
use tracing;
use std::env;
use serde_json::Value;

pub mod commands;
pub mod crypto;
pub mod database;
pub mod models;
pub mod services;
pub mod utils;

use database::Database;
use services::VaultService;
use commands::*;

fn get_db_path() -> std::path::PathBuf {
    if let Ok(custom_path) = env::var("SECUREVAULT_DB_PATH") {
        return std::path::PathBuf::from(custom_path);
    }

    let is_portable = env::args().any(|arg| arg == "--portable")
        || env::var("SECUREVAULT_PORTABLE").ok().as_deref() == Some("1")
        || std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.join("portable.flag")))
            .map(|flag| flag.exists())
            .unwrap_or(false);

    if is_portable {
        env::set_var("SECUREVAULT_PORTABLE", "1");
        let base_dir = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        let config_path = base_dir.join("securevault.config.json");
        if config_path.exists() {
            if let Ok(raw) = std::fs::read_to_string(&config_path) {
                if let Ok(json) = serde_json::from_str::<Value>(&raw) {
                    if let Some(path) = json.get("db_path").and_then(|v| v.as_str()) {
                        return std::path::PathBuf::from(path);
                    }
                }
            }
        }
        return base_dir.join("data").join("vault.db");
    }

    if let Some(dirs) = ProjectDirs::from("com", "securevault", "SecureVault") {
        let config_path = dirs.config_dir().join("securevault.config.json");
        if config_path.exists() {
            if let Ok(raw) = std::fs::read_to_string(config_path) {
                if let Ok(json) = serde_json::from_str::<Value>(&raw) {
                    if let Some(path) = json.get("db_path").and_then(|v| v.as_str()) {
                        return std::path::PathBuf::from(path);
                    }
                }
            }
        }
    }

    ProjectDirs::from("com", "securevault", "SecureVault")
        .map(|dirs| dirs.data_local_dir().join("vault.db"))
        .unwrap_or_else(|| std::path::PathBuf::from("vault.db"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = get_db_path();
    tracing::info!("Database path: {:?}", db_path);

    let db = match Database::new(db_path) {
        Ok(db) => Arc::new(db),
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            panic!("Database initialization failed: {}", e);
        }
    };

    let vault_service = VaultService::new(db);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(vault_service)
        .invoke_handler(tauri::generate_handler![
            check_has_user,
            setup_vault,
            unlock_vault,
            change_master_password,
            lock_vault,
            extend_session,
            is_unlocked,
            get_vaults,
            get_accounts,
            get_account,
            create_account,
            update_account,
            delete_account,
            get_account_fields,
            get_account_types,
            create_account_type,
            search_accounts,
            get_vault_stats,
            get_audit_logs,
            generate_password,
            decrypt_field,
            get_totp,
            save_totp,
            save_attachment,
            get_attachment,
            get_attachments,
            export_vault,
            export_vault_versioned,
            import_vault,
            import_vault_dry_run,
            run_db_health_check,
            get_customers,
            create_customer,
            delete_customer,
            get_access_users,
            create_access_user,
            update_access_user,
            delete_access_user,
            change_access_user_password,
            get_current_access_user,
            verify_current_access_user_password,
            get_app_storage_info,
            set_app_storage_path,
            list_app_databases,
            create_app_database,
            open_app_data_directory,
            update_account_type,
            delete_account_type,
            get_account_type_field_usage_count,
            export_account_type_templates,
            import_account_type_templates,
        ])
        .setup(|app| {
            tracing::info!("Tauri app setup complete");

            if let Some(main_window) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                main_window.on_window_event(move |event| {
                    if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                        tracing::info!("Main window close requested, exiting app");
                        app_handle.exit(0);
                    }
                });
            }

            #[cfg(desktop)]
            {
                use tauri::tray::TrayIconBuilder;
                use tauri::menu::{MenuBuilder, MenuItemBuilder};

                let quit = MenuItemBuilder::with_id("quit", "Quit SecureVault").build(app)?;
                let lock = MenuItemBuilder::with_id("lock", "Lock Vault").build(app)?;

                let menu = MenuBuilder::new(app)
                    .item(&lock)
                    .separator()
                    .item(&quit)
                    .build()?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .on_menu_event(move |app, event| {
                        match event.id().as_ref() {
                            "quit" => {
                                tracing::info!("Quit requested from tray");
                                app.exit(0);
                            }
                            "lock" => {
                                tracing::info!("Lock requested from tray");
                                let _ = app.emit("lock-vault", ());
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
