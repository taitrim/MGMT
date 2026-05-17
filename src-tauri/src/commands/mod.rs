use tauri::State;
use serde::{Deserialize, Serialize};
use directories::ProjectDirs;
use std::process::Command;
use std::path::PathBuf;

use crate::models::*;
use crate::services::{DbHealthResult, ImportDryRunResult, VaultService};
use crate::utils::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppStorageInfo {
    pub mode: String,
    pub db_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabasePathItem {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SetupRequest {
    pub display_name: String,
    pub master_password: String,
    pub admin_username: Option<String>,
    pub admin_password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnlockRequest {
    pub identifier: Option<String>,
    pub master_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangeMasterPasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAccountRequest {
    pub name: String,
    pub customer_id: Option<String>,
    pub account_type_id: Option<String>,
    pub has_expiry: Option<bool>,
    pub expires_at: Option<String>,
    pub fields: Vec<FieldValueInput>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateAccountRequest {
    pub id: String,
    pub name: Option<String>,
    pub customer_id: Option<String>,
    pub favorite: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub has_expiry: Option<bool>,
    pub expires_at: Option<String>,
    pub fields: Option<Vec<FieldValueInput>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCustomerRequest {
    pub name: String,
    pub contact: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAccessUserRequest {
    pub name: String,
    pub email: Option<String>,
    pub role: String,
    pub password: String,
    pub category_permissions: Option<Vec<String>>,
    pub can_view_password: Option<bool>,
    pub can_create_account: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateAccessUserRequest {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub category_permissions: Option<Vec<String>>,
    pub can_view_password: Option<bool>,
    pub can_create_account: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangeAccessUserPasswordRequest {
    pub id: String,
    pub new_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyCurrentAccessUserPasswordRequest {
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateAccountTypeRequest {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub fields: Vec<FieldDefinition>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountTypeTemplate {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub fields: Vec<FieldDefinition>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FieldValueInput {
    pub field_key: String,
    pub field_type: FieldType,
    pub value: String,
}

#[tauri::command]
pub async fn check_has_user(vault: State<'_, VaultService>) -> Result<bool, AppError> {
    vault.has_user()
}

#[tauri::command]
pub async fn setup_vault(vault: State<'_, VaultService>, request: SetupRequest) -> Result<(), AppError> {
    vault.setup(
        &request.display_name,
        &request.master_password,
        request.admin_username,
        request.admin_password,
    )
}

#[tauri::command]
pub async fn unlock_vault(vault: State<'_, VaultService>, request: UnlockRequest) -> Result<User, AppError> {
    if let Some(identifier) = request.identifier {
        if !identifier.trim().is_empty() {
            return vault.unlock_with_access_user(identifier.trim(), &request.master_password);
        }
    }
    vault.unlock(&request.master_password)
}

#[tauri::command]
pub async fn change_master_password(vault: State<'_, VaultService>, request: ChangeMasterPasswordRequest) -> Result<(), AppError> {
    vault.change_master_password(&request.current_password, &request.new_password)
}

#[tauri::command]
pub async fn lock_vault(vault: State<'_, VaultService>) -> Result<(), AppError> {
    vault.lock();
    Ok(())
}

#[tauri::command]
pub async fn extend_session(vault: State<'_, VaultService>) -> Result<(), AppError> {
    vault.extend_session()
}

#[tauri::command]
pub async fn is_unlocked(vault: State<'_, VaultService>) -> Result<bool, AppError> {
    Ok(vault.is_unlocked())
}

#[tauri::command]
pub async fn get_vaults(vault: State<'_, VaultService>) -> Result<Vec<Vault>, AppError> {
    vault.get_vaults()
}

#[tauri::command]
pub async fn get_accounts(vault: State<'_, VaultService>) -> Result<Vec<Account>, AppError> {
    vault.get_accounts()
}

#[tauri::command]
pub async fn get_account(vault: State<'_, VaultService>, id: String) -> Result<Option<Account>, AppError> {
    vault.get_account(&id)
}

#[tauri::command]
pub async fn create_account(vault: State<'_, VaultService>, request: CreateAccountRequest) -> Result<Account, AppError> {
    let fields: Vec<FieldValue> = request.fields.into_iter().map(|f| {
        FieldValue {
            id: uuid::Uuid::new_v4().to_string(),
            account_id: String::new(),
            field_key: f.field_key,
            field_type: f.field_type,
            value: f.value,
        }
    }).collect();

    vault.create_account(
        request.name,
        request.customer_id,
        request.account_type_id,
        request.has_expiry.unwrap_or(false),
        request.expires_at,
        fields,
    )
}

#[tauri::command]
pub async fn update_account(vault: State<'_, VaultService>, request: UpdateAccountRequest) -> Result<(), AppError> {
    let fields = request.fields.map(|fs| {
        fs.into_iter().map(|f| {
            FieldValue {
                id: uuid::Uuid::new_v4().to_string(),
                account_id: request.id.clone(),
                field_key: f.field_key,
                field_type: f.field_type,
                value: f.value,
            }
        }).collect()
    });

    vault.update_account(
        &request.id,
        request.name,
        request.customer_id,
        request.favorite,
        request.tags,
        request.has_expiry,
        request.expires_at,
        fields,
    )
}

#[tauri::command]
pub async fn delete_account(vault: State<'_, VaultService>, id: String) -> Result<(), AppError> {
    vault.delete_account(&id)
}

#[tauri::command]
pub async fn get_account_fields(vault: State<'_, VaultService>, account_id: String) -> Result<Vec<FieldValue>, AppError> {
    vault.get_account_fields(&account_id)
}

#[tauri::command]
pub async fn get_account_types(vault: State<'_, VaultService>) -> Result<Vec<AccountType>, AppError> {
    vault.get_account_types()
}

#[tauri::command]
pub async fn create_account_type(vault: State<'_, VaultService>, name: String, icon: Option<String>, color: Option<String>, fields: Vec<FieldDefinition>) -> Result<AccountType, AppError> {
    vault.create_account_type(name, icon, color, fields)
}

#[tauri::command]
pub async fn update_account_type(vault: State<'_, VaultService>, request: UpdateAccountTypeRequest) -> Result<(), AppError> {
    vault.update_account_type(&request.id, request.name, request.icon, request.color, request.fields)
}

#[tauri::command]
pub async fn delete_account_type(vault: State<'_, VaultService>, id: String) -> Result<(), AppError> {
    vault.delete_account_type(&id)
}

#[tauri::command]
pub async fn export_account_type_templates(vault: State<'_, VaultService>, dest_path: String) -> Result<(), AppError> {
    vault.export_account_type_templates(std::path::PathBuf::from(dest_path))
}

#[tauri::command]
pub async fn import_account_type_templates(vault: State<'_, VaultService>, src_path: String) -> Result<i64, AppError> {
    vault.import_account_type_templates(std::path::PathBuf::from(src_path))
}

#[tauri::command]
pub async fn get_account_type_field_usage_count(vault: State<'_, VaultService>, account_type_id: String, field_key: String) -> Result<i64, AppError> {
    vault.get_account_type_field_usage_count(&account_type_id, &field_key)
}

#[tauri::command]
pub async fn search_accounts(vault: State<'_, VaultService>, query: String) -> Result<Vec<Account>, AppError> {
    vault.search_accounts(&query)
}

#[tauri::command]
pub async fn get_vault_stats(vault: State<'_, VaultService>) -> Result<VaultStats, AppError> {
    vault.get_vault_stats()
}

#[tauri::command]
pub async fn get_audit_logs(vault: State<'_, VaultService>, limit: i64) -> Result<Vec<AuditLog>, AppError> {
    vault.get_audit_logs(limit)
}

#[tauri::command]
pub async fn generate_password(vault: State<'_, VaultService>, length: usize, include_special: bool) -> Result<String, AppError> {
    Ok(vault.generate_password(length, include_special))
}

#[tauri::command]
pub async fn decrypt_field(vault: State<'_, VaultService>, encrypted: String, nonce: String) -> Result<String, AppError> {
    vault.decrypt_field(&encrypted, &nonce)
}

#[tauri::command]
pub async fn get_totp(vault: State<'_, VaultService>, account_id: String) -> Result<String, AppError> {
    vault.get_totp(&account_id)
}

#[tauri::command]
pub async fn save_totp(vault: State<'_, VaultService>, account_id: String, secret: String, issuer: Option<String>) -> Result<(), AppError> {
    vault.save_totp(&account_id, &secret, issuer)
}

#[tauri::command]
pub async fn save_attachment(vault: State<'_, VaultService>, account_id: String, filename: String, mime_type: Option<String>, data: Vec<u8>) -> Result<(), AppError> {
    vault.save_attachment(&account_id, filename, mime_type, data)
}

#[tauri::command]
pub async fn get_attachment(vault: State<'_, VaultService>, id: String) -> Result<(String, Vec<u8>), AppError> {
    vault.get_attachment(&id)
}

#[tauri::command]
pub async fn get_attachments(vault: State<'_, VaultService>, account_id: String) -> Result<Vec<Attachment>, AppError> {
    vault.get_attachments(&account_id)
}

#[tauri::command]
pub async fn export_vault(vault: State<'_, VaultService>, dest_path: String) -> Result<(), AppError> {
    vault.export_vault(std::path::PathBuf::from(dest_path))
}

#[tauri::command]
pub async fn export_vault_versioned(
    vault: State<'_, VaultService>,
    dest_dir: String,
    keep_last: Option<usize>,
) -> Result<String, AppError> {
    let keep = keep_last.unwrap_or(10).max(1);
    let path = vault.export_vault_versioned(std::path::PathBuf::from(dest_dir), keep)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn import_vault(vault: State<'_, VaultService>, src_path: String) -> Result<(), AppError> {
    vault.import_vault(std::path::PathBuf::from(src_path))
}

#[tauri::command]
pub async fn import_vault_dry_run(vault: State<'_, VaultService>, src_path: String) -> Result<ImportDryRunResult, AppError> {
    vault.import_vault_dry_run(std::path::PathBuf::from(src_path))
}

#[tauri::command]
pub async fn run_db_health_check(vault: State<'_, VaultService>) -> Result<DbHealthResult, AppError> {
    vault.run_db_health_check()
}

#[tauri::command]
pub async fn get_customers(vault: State<'_, VaultService>) -> Result<Vec<Customer>, AppError> {
    vault.get_customers()
}

#[tauri::command]
pub async fn create_customer(vault: State<'_, VaultService>, request: CreateCustomerRequest) -> Result<Customer, AppError> {
    vault.create_customer(request.name, request.contact, request.notes)
}

#[tauri::command]
pub async fn delete_customer(vault: State<'_, VaultService>, id: String) -> Result<(), AppError> {
    vault.delete_customer(&id)
}

#[tauri::command]
pub async fn get_access_users(vault: State<'_, VaultService>) -> Result<Vec<AccessUser>, AppError> {
    vault.get_access_users()
}

#[tauri::command]
pub async fn create_access_user(vault: State<'_, VaultService>, request: CreateAccessUserRequest) -> Result<AccessUser, AppError> {
    vault.create_access_user(
        request.name,
        request.email,
        request.role,
        request.password,
        request.category_permissions.unwrap_or_default(),
        request.can_view_password.unwrap_or(false),
        request.can_create_account.unwrap_or(false),
    )
}

#[tauri::command]
pub async fn update_access_user(vault: State<'_, VaultService>, request: UpdateAccessUserRequest) -> Result<(), AppError> {
    vault.update_access_user(
        &request.id,
        request.name,
        request.email,
        request.role,
        request.is_active,
        request.category_permissions.unwrap_or_default(),
        request.can_view_password.unwrap_or(false),
        request.can_create_account.unwrap_or(false),
    )
}

#[tauri::command]
pub async fn delete_access_user(vault: State<'_, VaultService>, id: String) -> Result<(), AppError> {
    vault.delete_access_user(&id)
}

#[tauri::command]
pub async fn change_access_user_password(vault: State<'_, VaultService>, request: ChangeAccessUserPasswordRequest) -> Result<(), AppError> {
    vault.change_access_user_password(&request.id, request.new_password)
}

#[tauri::command]
pub async fn get_current_access_user(vault: State<'_, VaultService>) -> Result<Option<AccessUser>, AppError> {
    vault.get_current_access_user()
}

#[tauri::command]
pub async fn verify_current_access_user_password(vault: State<'_, VaultService>, request: VerifyCurrentAccessUserPasswordRequest) -> Result<bool, AppError> {
    vault.verify_current_access_user_password(&request.password)
}

#[tauri::command]
pub async fn get_app_storage_info(vault: State<'_, VaultService>) -> Result<AppStorageInfo, AppError> {
    Ok(AppStorageInfo {
        mode: vault.get_storage_mode(),
        db_path: vault.get_db_path().to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn set_app_storage_path(vault: State<'_, VaultService>, db_path: String) -> Result<(), AppError> {
    vault.ensure_owner_or_admin()?;
    let db_file = std::path::PathBuf::from(db_path);
    let config_path = if std::env::var("SECUREVAULT_PORTABLE").ok().as_deref() == Some("1") {
        let base_dir = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        base_dir.join("securevault.config.json")
    } else {
        let dirs = ProjectDirs::from("com", "securevault", "SecureVault")
            .ok_or_else(|| AppError::InvalidOperation("Cannot resolve config directory".to_string()))?;
        dirs.config_dir().join("securevault.config.json")
    };
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let payload = serde_json::json!({ "db_path": db_file.to_string_lossy().to_string() });
    std::fs::write(config_path, serde_json::to_string_pretty(&payload)?)?;
    Ok(())
}

#[tauri::command]
pub async fn list_app_databases(vault: State<'_, VaultService>) -> Result<Vec<DatabasePathItem>, AppError> {
    vault.ensure_owner_or_admin()?;
    let db_path = vault.get_db_path();
    let parent = db_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let mut out = Vec::new();
    if parent.exists() {
        for entry in std::fs::read_dir(parent)? {
            let entry = entry?;
            let p = entry.path();
            if p.is_file() && p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("db")).unwrap_or(false) {
                let name = p.file_stem().and_then(|s| s.to_str()).unwrap_or("vault").to_string();
                out.push(DatabasePathItem {
                    name,
                    path: p.to_string_lossy().to_string(),
                });
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
pub async fn create_app_database(vault: State<'_, VaultService>, name: String) -> Result<DatabasePathItem, AppError> {
    vault.ensure_owner_or_admin()?;
    let base = vault.get_db_path();
    let parent = base
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    std::fs::create_dir_all(&parent)?;
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidOperation("Database name is required".to_string()));
    }
    let safe_name: String = trimmed
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let file_name = format!("{}.db", safe_name);
    let db_path = parent.join(file_name);
    if !db_path.exists() {
        let _conn = rusqlite::Connection::open(&db_path)?;
    }
    Ok(DatabasePathItem {
        name: safe_name,
        path: db_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn open_app_data_directory(vault: State<'_, VaultService>) -> Result<(), AppError> {
    let db_path = vault.get_db_path();
    let target_dir = db_path.parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    Command::new("explorer")
        .arg(target_dir)
        .spawn()?;
    Ok(())
}
