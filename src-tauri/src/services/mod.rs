use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;
use uuid::Uuid;
use rand::Rng;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

use crate::crypto::CryptoService;
use crate::database::Database;
use crate::models::*;
use crate::utils::{AppError, AppResult};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportDryRunResult {
    pub version: i64,
    pub algorithm: String,
    pub checksum_valid: bool,
    pub sqlite_valid: bool,
    pub bytes: usize,
    pub created_at: Option<String>,
    pub app_version: Option<String>,
    pub schema_hash: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DbHealthResult {
    pub db_path: String,
    pub exists: bool,
    pub quick_ok: bool,
    pub integrity_ok: bool,
    pub page_count: i64,
}

pub struct VaultService {
    db: Arc<Database>,
    crypto: Arc<RwLock<CryptoService>>,
    current_user_id: Arc<RwLock<Option<String>>>,
    current_vault_id: Arc<RwLock<Option<String>>>,
    session_expires_at: Arc<RwLock<Option<chrono::DateTime<Utc>>>>,
}

impl VaultService {
    fn is_encrypted_metadata(value: &str) -> bool {
        value.starts_with("enc::")
    }

    fn encrypt_metadata(&self, value: &str) -> AppResult<String> {
        let (ciphertext, nonce) = self.crypto.read().encrypt(value)?;
        Ok(format!("enc::{}::{}", nonce, ciphertext))
    }

    fn decrypt_metadata_compat(&self, value: &str) -> String {
        if let Some(rest) = value.strip_prefix("enc::") {
            let mut parts = rest.splitn(2, "::");
            if let (Some(nonce), Some(ciphertext)) = (parts.next(), parts.next()) {
                return self.crypto.read().decrypt(ciphertext, nonce).unwrap_or_default();
            }
            return String::new();
        }
        value.to_string()
    }

    fn encrypt_optional_metadata(&self, value: Option<String>) -> AppResult<Option<String>> {
        match value {
            Some(v) if !v.trim().is_empty() => Ok(Some(self.encrypt_metadata(&v)?)),
            _ => Ok(None),
        }
    }

    fn migrate_legacy_sensitive_data(&self, vault_id: &str, user_id: &str) -> AppResult<()> {
        let mut changed_accounts = 0_i64;
        let mut changed_customers = 0_i64;

        let mut accounts = self.db.get_accounts(vault_id)?;
        for account in &mut accounts {
            if !Self::is_encrypted_metadata(&account.name) {
                account.name = self.encrypt_metadata(&account.name)?;
                self.db.update_account(account)?;
                changed_accounts += 1;
            }
        }

        let customers = self.db.get_customers(vault_id)?;
        for customer in customers {
            let old_contact = customer.contact.clone();
            let old_notes = customer.notes.clone();

            let contact_enc = match old_contact.clone() {
                Some(c) if !c.trim().is_empty() && !Self::is_encrypted_metadata(&c) => Some(self.encrypt_metadata(&c)?),
                other => other,
            };
            let notes_enc = match old_notes.clone() {
                Some(n) if !n.trim().is_empty() && !Self::is_encrypted_metadata(&n) => Some(self.encrypt_metadata(&n)?),
                other => other,
            };

            if contact_enc != old_contact || notes_enc != old_notes {
                self.db.update_customer_sensitive(&customer.id, contact_enc, notes_enc)?;
                changed_customers += 1;
            }
        }

        if changed_accounts > 0 || changed_customers > 0 {
            let audit_log = AuditLog {
                id: Uuid::new_v4().to_string(),
                user_id: user_id.to_string(),
                action: "migrate_sensitive_metadata".to_string(),
                target_type: Some("vault".to_string()),
                target_id: Some(vault_id.to_string()),
                details: Some(serde_json::json!({
                    "accounts": changed_accounts,
                    "customers": changed_customers
                })),
                created_at: Utc::now(),
            };
            self.db.add_audit_log(&audit_log)?;
        }

        Ok(())
    }

    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            crypto: Arc::new(RwLock::new(CryptoService::new())),
            current_user_id: Arc::new(RwLock::new(None)),
            current_vault_id: Arc::new(RwLock::new(None)),
            session_expires_at: Arc::new(RwLock::new(None)),
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.current_user_id.read().is_some() && self.crypto.read().has_master_key()
    }

    pub fn get_current_user_id(&self) -> AppResult<String> {
        self.current_user_id
            .read()
            .clone()
            .ok_or(AppError::VaultLocked)
    }

    pub fn get_current_vault_id(&self) -> AppResult<String> {
        self.current_vault_id
            .read()
            .clone()
            .ok_or(AppError::VaultLocked)
    }

    fn check_session(&self) -> AppResult<()> {
        if let Some(expires) = *self.session_expires_at.read() {
            if Utc::now() > expires {
                self.lock();
                return Err(AppError::SessionExpired);
            }
        }
        Ok(())
    }

    pub fn setup(&self, display_name: &str, master_password: &str) -> AppResult<()> {
        let salt = CryptoService::generate_salt();
        let (hash, _) = self.crypto.read().hash_password(master_password)?;

        let user = User::new(display_name.to_string(), hash, salt.clone());
        self.db.create_user(&user)?;

        let salt_bytes = BASE64.decode(&salt).map_err(|e| AppError::Crypto(e.to_string()))?;
        let key = self.crypto.read().derive_key(master_password, &salt_bytes)?;
        self.crypto.write().set_master_key(key);

        let vault = Vault::new(user.id.clone(), "Default".to_string(), true);
        self.db.create_vault(&vault)?;

        *self.current_user_id.write() = Some(user.id);
        *self.current_vault_id.write() = Some(vault.id);
        *self.session_expires_at.write() = Some(Utc::now() + chrono::Duration::minutes(15));

        Ok(())
    }

    pub fn unlock(&self, master_password: &str) -> AppResult<User> {
        let user = match self.db.get_users()?.first() {
            Some(u) => u.clone(),
            None => return Err(AppError::Auth("No user found. Please set up your vault first.".to_string())),
        };

        if let Some(locked_until) = user.locked_until {
            if Utc::now() < locked_until {
                let remaining = (locked_until - Utc::now()).num_seconds();
                return Err(AppError::BruteForceProtection(remaining.max(0) as u64));
            }
        }

        let is_valid = self.crypto.read().verify_password(master_password, &user.master_key_hash)?;

        if !is_valid {
            let attempts = user.failed_attempts + 1;
            let locked_until = if attempts >= 5 {
                Some(Utc::now() + chrono::Duration::seconds(60 * (attempts as i64 - 4)))
            } else {
                None
            };
            self.db.update_user_failed_attempts(&user.id, attempts, locked_until)?;
            return Err(AppError::InvalidPassword);
        }

        self.db.update_user_failed_attempts(&user.id, 0, None)?;

        let salt_bytes = BASE64.decode(&user.salt).map_err(|e| AppError::Crypto(e.to_string()))?;
        let key = self.crypto.read().derive_key(master_password, &salt_bytes)?;
        self.crypto.write().set_master_key(key);

        *self.current_user_id.write() = Some(user.id.clone());

        if let Some(vault) = self.db.get_default_vault(&user.id)? {
            *self.current_vault_id.write() = Some(vault.id);
        }

        if let Some(vault_id) = self.current_vault_id.read().clone() {
            self.migrate_legacy_sensitive_data(&vault_id, &user.id)?;
        }

        *self.session_expires_at.write() = Some(Utc::now() + chrono::Duration::minutes(15));

        let audit_log = AuditLog {
            id: Uuid::new_v4().to_string(),
            user_id: user.id.clone(),
            action: "unlock".to_string(),
            target_type: None,
            target_id: None,
            details: None,
            created_at: Utc::now(),
        };
        self.db.add_audit_log(&audit_log)?;

        Ok(user)
    }

    pub fn lock(&self) {
        self.crypto.write().clear_master_key();
        *self.current_user_id.write() = None;
        *self.current_vault_id.write() = None;
        *self.session_expires_at.write() = None;
    }

    pub fn extend_session(&self) -> AppResult<()> {
        self.check_session()?;
        *self.session_expires_at.write() = Some(Utc::now() + chrono::Duration::minutes(15));
        Ok(())
    }

    pub fn export_vault(&self, dest_path: std::path::PathBuf) -> AppResult<()> {
        self.check_session()?;
        let src_path = self.db.get_path();
        let data = std::fs::read(&src_path)?;
        let checksum = CryptoService::compute_hash(&BASE64.encode(&data));
        let (ciphertext, nonce) = self.crypto.read().encrypt_bytes(&data)?;
        let schema_hash = self.db.schema_fingerprint()?;
        let backup = serde_json::json!({
            "version": 1,
            "algorithm": "AES-256-GCM",
            "created_at": Utc::now().to_rfc3339(),
            "app_version": env!("CARGO_PKG_VERSION"),
            "schema_hash": schema_hash,
            "checksum": checksum,
            "nonce": BASE64.encode(&nonce),
            "data": BASE64.encode(&ciphertext),
        });
        let backup_str = serde_json::to_string_pretty(&backup)?;
        std::fs::write(&dest_path, backup_str)?;
        Ok(())
    }

    pub fn import_vault(&self, src_path: std::path::PathBuf) -> AppResult<()> {
        let _ = self.import_vault_dry_run(src_path.clone())?;
        let backup_str = std::fs::read_to_string(&src_path)?;
        let backup: serde_json::Value = serde_json::from_str(&backup_str)?;
        let version = backup["version"].as_i64().unwrap_or(0);
        if version != 1 {
            return Err(AppError::Backup("Unsupported backup version".to_string()));
        }
        let nonce = BASE64.decode(backup["nonce"].as_str().ok_or(AppError::Backup("Missing nonce".to_string()))?)
            .map_err(|e| AppError::Backup(format!("Invalid nonce: {}", e)))?;
        let ciphertext = BASE64.decode(backup["data"].as_str().ok_or(AppError::Backup("Missing data".to_string()))?)
            .map_err(|e| AppError::Backup(format!("Invalid data: {}", e)))?;
        let expected_checksum = backup["checksum"].as_str().ok_or(AppError::Backup("Missing checksum".to_string()))?;
        let data = self.crypto.read().decrypt_bytes(&ciphertext, &nonce)?;
        let actual_checksum = CryptoService::compute_hash(&BASE64.encode(&data));
        if actual_checksum != expected_checksum {
            return Err(AppError::Backup("Checksum mismatch - backup may be corrupted".to_string()));
        }
        let dest_path = self.db.get_path();
        self.lock();
        std::fs::write(&dest_path, &data)?;
        Ok(())
    }

    pub fn import_vault_dry_run(&self, src_path: std::path::PathBuf) -> AppResult<ImportDryRunResult> {
        let backup_str = std::fs::read_to_string(&src_path)?;
        let backup: serde_json::Value = serde_json::from_str(&backup_str)?;
        let version = backup["version"].as_i64().unwrap_or(0);
        if version != 1 {
            return Err(AppError::Backup("Unsupported backup version".to_string()));
        }
        let algorithm = backup["algorithm"].as_str().unwrap_or("unknown").to_string();
        let created_at = backup["created_at"].as_str().map(|s| s.to_string());
        let app_version = backup["app_version"].as_str().map(|s| s.to_string());
        let schema_hash = backup["schema_hash"].as_str().map(|s| s.to_string());
        let nonce = BASE64.decode(backup["nonce"].as_str().ok_or(AppError::Backup("Missing nonce".to_string()))?)
            .map_err(|e| AppError::Backup(format!("Invalid nonce: {}", e)))?;
        let ciphertext = BASE64.decode(backup["data"].as_str().ok_or(AppError::Backup("Missing data".to_string()))?)
            .map_err(|e| AppError::Backup(format!("Invalid data: {}", e)))?;
        let expected_checksum = backup["checksum"].as_str().ok_or(AppError::Backup("Missing checksum".to_string()))?;
        let data = self.crypto.read().decrypt_bytes(&ciphertext, &nonce)?;
        let actual_checksum = CryptoService::compute_hash(&BASE64.encode(&data));
        let checksum_valid = actual_checksum == expected_checksum;
        if !checksum_valid {
            return Err(AppError::Backup("Checksum mismatch - backup may be corrupted".to_string()));
        }
        let sqlite_header = b"SQLite format 3\0";
        let sqlite_valid = data.len() >= sqlite_header.len() && &data[..sqlite_header.len()] == sqlite_header;
        if !sqlite_valid {
            return Err(AppError::Backup("Backup payload is not a valid SQLite database".to_string()));
        }

        Ok(ImportDryRunResult {
            version,
            algorithm,
            checksum_valid,
            sqlite_valid,
            bytes: data.len(),
            created_at,
            app_version,
            schema_hash,
        })
    }

    pub fn run_db_health_check(&self) -> AppResult<DbHealthResult> {
        let db_path = self.db.get_path();
        let exists = db_path.exists();
        let (quick_ok, integrity_ok, page_count) = if exists {
            self.db.health_check()?
        } else {
            (false, false, 0)
        };
        Ok(DbHealthResult {
            db_path: db_path.to_string_lossy().to_string(),
            exists,
            quick_ok,
            integrity_ok,
            page_count,
        })
    }

    pub fn get_vaults(&self) -> AppResult<Vec<Vault>> {
        self.check_session()?;
        let user_id = self.get_current_user_id()?;
        self.db.get_vaults(&user_id)
    }

    pub fn get_accounts(&self) -> AppResult<Vec<Account>> {
        self.check_session()?;
        let vault_id = self.get_current_vault_id()?;
        let mut accounts = self.db.get_accounts(&vault_id)?;
        for account in &mut accounts {
            account.name = self.decrypt_metadata_compat(&account.name);
        }
        Ok(accounts)
    }

    pub fn get_account(&self, id: &str) -> AppResult<Option<Account>> {
        self.check_session()?;
        let mut account = self.db.get_account(id)?;
        if let Some(a) = &mut account {
            a.name = self.decrypt_metadata_compat(&a.name);
        }
        Ok(account)
    }

    pub fn create_account(
        &self,
        name: String,
        customer_id: Option<String>,
        account_type_id: Option<String>,
        has_expiry: bool,
        expires_at: Option<String>,
        fields: Vec<FieldValue>,
    ) -> AppResult<Account> {
        self.check_session()?;
        let vault_id = self.get_current_vault_id()?;
        let user_id = self.get_current_user_id()?;
        let type_fields = if let Some(type_id) = &account_type_id {
            self.db.get_account_type(type_id)?.map(|t| t.fields).unwrap_or_default()
        } else {
            Vec::new()
        };

        let mut account = Account::new(vault_id, name.clone());
        account.customer_id = customer_id;
        account.account_type_id = account_type_id;
        account.name = self.encrypt_metadata(&name)?;
        account.has_expiry = has_expiry;
        account.expires_at = if has_expiry {
            expires_at
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|d| d.with_timezone(&Utc))
        } else {
            None
        };
        self.db.create_account(&account)?;

        for mut field in fields {
            if !field.value.is_empty() {
                field.account_id = account.id.clone();
                let should_encrypt = type_fields
                    .iter()
                    .find(|f| f.key == field.field_key)
                    .map(|f| f.encrypted)
                    .unwrap_or(true);

                if should_encrypt {
                    let (encrypted, nonce) = self.crypto.read().encrypt(&field.value)?;
                    self.db.save_field_value(&field, &encrypted, &nonce)?;
                } else {
                    self.db.save_field_value(&field, &field.value, "")?;
                }
            }
        }

        let audit_log = AuditLog {
            id: Uuid::new_v4().to_string(),
            user_id,
            action: "create_account".to_string(),
            target_type: Some("account".to_string()),
            target_id: Some(account.id.clone()),
            details: None,
            created_at: Utc::now(),
        };
        self.db.add_audit_log(&audit_log)?;

        account.name = name;
        Ok(account)
    }

    pub fn update_account(
        &self,
        id: &str,
        name: Option<String>,
        customer_id: Option<String>,
        favorite: Option<bool>,
        tags: Option<Vec<String>>,
        has_expiry: Option<bool>,
        expires_at: Option<String>,
        fields: Option<Vec<FieldValue>>,
    ) -> AppResult<()> {
        self.check_session()?;
        let user_id = self.get_current_user_id()?;

        if let Some(mut account) = self.db.get_account(id)? {
            let type_fields = if let Some(type_id) = &account.account_type_id {
                self.db.get_account_type(type_id)?.map(|t| t.fields).unwrap_or_default()
            } else {
                Vec::new()
            };

            if let Some(n) = name {
                account.name = self.encrypt_metadata(&n)?;
            }
            if customer_id.is_some() {
                account.customer_id = customer_id;
            }
            if let Some(f) = favorite {
                account.favorite = f;
            }
            if let Some(t) = tags {
                account.tags = t;
            }
            if let Some(he) = has_expiry {
                account.has_expiry = he;
                account.expires_at = if he {
                    expires_at
                        .as_deref()
                        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                        .map(|d| d.with_timezone(&Utc))
                } else {
                    None
                };
            }
            account.updated_at = Utc::now();
            self.db.update_account(&account)?;

            if let Some(field_values) = fields {
                for mut field in field_values {
                    if !field.value.is_empty() {
                        field.account_id = account.id.clone();
                        let should_encrypt = type_fields
                            .iter()
                            .find(|f| f.key == field.field_key)
                            .map(|f| f.encrypted)
                            .unwrap_or(true);

                        if should_encrypt {
                            let (encrypted, nonce) = self.crypto.read().encrypt(&field.value)?;
                            self.db.save_field_value(&field, &encrypted, &nonce)?;
                        } else {
                            self.db.save_field_value(&field, &field.value, "")?;
                        }
                    }
                }
            }

            let audit_log = AuditLog {
                id: Uuid::new_v4().to_string(),
                user_id,
                action: "update_account".to_string(),
                target_type: Some("account".to_string()),
                target_id: Some(id.to_string()),
                details: None,
                created_at: Utc::now(),
            };
            self.db.add_audit_log(&audit_log)?;
        }

        Ok(())
    }

    pub fn delete_account(&self, id: &str) -> AppResult<()> {
        self.check_session()?;
        let user_id = self.get_current_user_id()?;

        self.db.delete_account(id)?;

        let audit_log = AuditLog {
            id: Uuid::new_v4().to_string(),
            user_id,
            action: "delete_account".to_string(),
            target_type: Some("account".to_string()),
            target_id: Some(id.to_string()),
            details: None,
            created_at: Utc::now(),
        };
        self.db.add_audit_log(&audit_log)?;

        Ok(())
    }

    pub fn get_account_fields(&self, account_id: &str) -> AppResult<Vec<FieldValue>> {
        self.check_session()?;

        let account = self.db.get_account(account_id)?.ok_or(AppError::AccountNotFound(account_id.to_string()))?;
        let type_fields = if let Some(type_id) = &account.account_type_id {
            self.db.get_account_type(type_id)?.map(|t| t.fields).unwrap_or_default()
        } else {
            Vec::new()
        };

        let encrypted_fields = self.db.get_field_values(account_id)?;

        let mut result = Vec::new();
        for (field_key, field_type_str, encrypted, nonce) in encrypted_fields {
            let field_type: FieldType = serde_json::from_str(&field_type_str).unwrap_or(FieldType::Text);

            let is_encrypted = type_fields.iter().any(|f| f.key == field_key && f.encrypted);
            let decrypted_value = if is_encrypted {
                self.crypto.read().decrypt(&encrypted, &nonce).unwrap_or_default()
            } else {
                // Compatibility: older builds encrypted all fields, including non-sensitive ones.
                // If nonce exists and decryption succeeds, show decrypted value; otherwise keep plaintext.
                if !nonce.is_empty() {
                    self.crypto.read().decrypt(&encrypted, &nonce).unwrap_or(encrypted)
                } else {
                    encrypted
                }
            };

            result.push(FieldValue {
                id: Uuid::new_v4().to_string(),
                account_id: account_id.to_string(),
                field_key,
                field_type,
                value: decrypted_value,
            });
        }

        Ok(result)
    }

    pub fn decrypt_field(&self, encrypted: &str, nonce: &str) -> AppResult<String> {
        self.check_session()?;
        self.crypto.read().decrypt(encrypted, nonce)
    }

    pub fn get_account_types(&self) -> AppResult<Vec<AccountType>> {
        self.check_session()?;
        let vault_id = self.get_current_vault_id()?;
        self.db.seed_builtin_types_for_vault(&vault_id)?;
        self.db.get_account_types(&vault_id)
    }

    pub fn create_account_type(&self, name: String, icon: Option<String>, color: Option<String>, fields: Vec<FieldDefinition>) -> AppResult<AccountType> {
        self.check_session()?;
        let vault_id = self.get_current_vault_id()?;
        
        let account_type = AccountType {
            id: Uuid::new_v4().to_string(),
            vault_id,
            name,
            icon,
            color,
            fields,
            created_at: Utc::now(),
            is_builtin: false,
            is_deleted: false,
        };

        self.db.create_account_type(&account_type)?;
        Ok(account_type)
    }

    pub fn update_account_type(&self, id: &str, name: String, icon: Option<String>, color: Option<String>, fields: Vec<FieldDefinition>) -> AppResult<()> {
        self.check_session()?;
        let mut account_type = self.db.get_account_type(id)?
            .ok_or(AppError::InvalidOperation("Account type not found".to_string()))?;
        if account_type.is_builtin {
            return Err(AppError::InvalidOperation("Cannot edit builtin account type".to_string()));
        }
        account_type.name = name;
        account_type.icon = icon;
        account_type.color = color;
        account_type.fields = fields;
        self.db.update_account_type(&account_type)
    }

    pub fn delete_account_type(&self, id: &str) -> AppResult<()> {
        self.check_session()?;
        let account_type = self.db.get_account_type(id)?
            .ok_or(AppError::InvalidOperation("Account type not found".to_string()))?;
        if account_type.is_builtin {
            return Err(AppError::InvalidOperation("Cannot delete builtin account type".to_string()));
        }
        self.db.delete_account_type(id)
    }

    pub fn get_account_type_field_usage_count(&self, account_type_id: &str, field_key: &str) -> AppResult<i64> {
        self.check_session()?;
        self.db.get_account_type_field_usage_count(account_type_id, field_key)
    }

    pub fn search_accounts(&self, query: &str) -> AppResult<Vec<Account>> {
        self.check_session()?;
        let q = query.to_lowercase();
        if q.trim().is_empty() {
            return self.get_accounts();
        }

        let vault_id = self.get_current_vault_id()?;
        let customers = self.get_customers()?;
        let customer_map = customers
            .into_iter()
            .map(|c| (c.id, c.name.to_lowercase()))
            .collect::<std::collections::HashMap<_, _>>();

        let accounts = self.get_accounts()?;
        let mut result = Vec::new();

        for account in accounts {
            let mut matched = account.name.to_lowercase().contains(&q)
                || account.tags.iter().any(|t| t.to_lowercase().contains(&q))
                || account
                    .customer_id
                    .as_ref()
                    .and_then(|cid| customer_map.get(cid))
                    .map(|name| name.contains(&q))
                    .unwrap_or(false);

            if !matched {
                let fields = self.get_account_fields(&account.id)?;
                matched = fields.iter().any(|f| {
                    f.field_key.to_lowercase().contains(&q) || f.value.to_lowercase().contains(&q)
                });
            }

            if matched {
                result.push(account);
            }
        }

        // Keep deterministic order similar to DB ordering (created_at desc not guaranteed in DB now)
        result.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        // Avoid unused var warning in case future DB fallback is needed
        let _ = vault_id;
        Ok(result)
    }

    pub fn get_vault_stats(&self) -> AppResult<VaultStats> {
        self.check_session()?;
        let vault_id = self.get_current_vault_id()?;
        self.db.get_vault_stats(&vault_id)
    }

    pub fn get_audit_logs(&self, limit: i64) -> AppResult<Vec<AuditLog>> {
        self.check_session()?;
        let user_id = self.get_current_user_id()?;
        self.db.get_audit_logs(&user_id, limit)
    }

    pub fn get_totp(&self, account_id: &str) -> AppResult<String> {
        self.check_session()?;
        
        let (encrypted_secret, nonce, algorithm, digits, period, _) = self.db.get_totp_secret(account_id)?
            .ok_or(AppError::Totp("No TOTP secret found".to_string()))?;

        let secret = self.crypto.read().decrypt(&encrypted_secret, &nonce)?;
        
        use totp_rs::{TOTP, Algorithm};
        
        let algo = match algorithm.as_str() {
            "SHA256" => Algorithm::SHA256,
            "SHA512" => Algorithm::SHA512,
            _ => Algorithm::SHA1,
        };

        let totp = TOTP::new(
            algo,
            digits as usize,
            1,
            period as u64,
            secret.into_bytes(),
            None,
            String::new(),
        ).map_err(|e| AppError::Totp(e.to_string()))?;

        Ok(totp.generate_current().map_err(|e| AppError::Totp(e.to_string()))?)
    }

    pub fn save_totp(&self, account_id: &str, secret: &str, issuer: Option<String>) -> AppResult<()> {
        self.check_session()?;
        
        let (encrypted, nonce) = self.crypto.read().encrypt(secret)?;
        
        let totp_secret = TotpSecret {
            id: Uuid::new_v4().to_string(),
            account_id: account_id.to_string(),
            secret: String::new(),
            algorithm: "SHA1".to_string(),
            digits: 6,
            period: 30,
            issuer,
            created_at: Utc::now(),
        };

        self.db.save_totp_secret(&totp_secret, &encrypted, &nonce)
    }

    pub fn save_attachment(&self, account_id: &str, filename: String, mime_type: Option<String>, data: Vec<u8>) -> AppResult<()> {
        self.check_session()?;
        
        let key = self.crypto.read().get_master_key().ok_or(AppError::VaultLocked)?;
        
        use aes_gcm::{Aes256Gcm, aead::{Aead, KeyInit, OsRng}, Nonce};
        use rand::RngCore;
        
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| AppError::Crypto(e.to_string()))?;
        
        let encrypted_data = cipher.encrypt(nonce, data.as_slice()).map_err(|e| AppError::Crypto(e.to_string()))?;
        let nonce_b64 = BASE64.encode(nonce_bytes);

        let attachment = Attachment {
            id: Uuid::new_v4().to_string(),
            account_id: account_id.to_string(),
            filename,
            mime_type,
            data: Vec::new(),
            size: data.len() as i64,
            created_at: Utc::now(),
        };

        self.db.save_attachment(&attachment, &encrypted_data, &nonce_b64)
    }

    pub fn get_attachment(&self, id: &str) -> AppResult<(String, Vec<u8>)> {
        self.check_session()?;
        
        let key = self.crypto.read().get_master_key().ok_or(AppError::VaultLocked)?;
        let (encrypted_data, nonce_b64) = self.db.get_attachment_data(id)?
            .ok_or(AppError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "Attachment not found")))?;

        use aes_gcm::{Aes256Gcm, aead::{Aead, KeyInit}, Nonce};
        
        let nonce_bytes = BASE64.decode(nonce_b64).map_err(|e| AppError::Crypto(e.to_string()))?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| AppError::Crypto(e.to_string()))?;
        
        let decrypted_data = cipher.decrypt(nonce, encrypted_data.as_slice()).map_err(|e| AppError::Crypto(e.to_string()))?;

        Ok((String::new(), decrypted_data))
    }

    pub fn get_attachments(&self, account_id: &str) -> AppResult<Vec<Attachment>> {
        self.check_session()?;
        self.db.get_attachments(account_id)
    }

    pub fn get_customers(&self) -> AppResult<Vec<Customer>> {
        self.check_session()?;
        let vault_id = self.get_current_vault_id()?;
        let mut customers = self.db.get_customers(&vault_id)?;
        for customer in &mut customers {
            customer.contact = customer.contact.as_ref().map(|c| self.decrypt_metadata_compat(c));
            customer.notes = customer.notes.as_ref().map(|n| self.decrypt_metadata_compat(n));
        }
        Ok(customers)
    }

    pub fn create_customer(&self, name: String, contact: Option<String>, notes: Option<String>) -> AppResult<Customer> {
        self.check_session()?;
        let vault_id = self.get_current_vault_id()?;
        let customer = Customer {
            id: Uuid::new_v4().to_string(),
            vault_id,
            name,
            contact: self.encrypt_optional_metadata(contact)?,
            notes: self.encrypt_optional_metadata(notes)?,
            created_at: Utc::now(),
            is_deleted: false,
        };
        self.db.create_customer(&customer)?;
        Ok(Customer {
            contact: customer.contact.as_ref().map(|c| self.decrypt_metadata_compat(c)),
            notes: customer.notes.as_ref().map(|n| self.decrypt_metadata_compat(n)),
            ..customer
        })
    }

    pub fn delete_customer(&self, id: &str) -> AppResult<()> {
        self.check_session()?;
        self.db.delete_customer(id)
    }

    pub fn has_user(&self) -> AppResult<bool> {
        let users = self.db.get_users()?;
        Ok(!users.is_empty())
    }

    pub fn generate_password(&self, length: usize, include_special: bool) -> String {
        let charset = if include_special {
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
        } else {
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        };

        let mut rng = rand::thread_rng();
        (0..length)
            .map(|_| {
                let idx = rng.gen_range(0..charset.len());
                charset.chars().nth(idx).unwrap_or('a')
            })
            .collect()
    }

    pub fn get_db_path(&self) -> std::path::PathBuf {
        self.db.get_path()
    }

    pub fn get_storage_mode(&self) -> String {
        if std::env::var("SECUREVAULT_PORTABLE").ok().as_deref() == Some("1") {
            return "portable".to_string();
        }
        "installed".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn create_test_service() -> VaultService {
        let db_path = std::env::temp_dir().join(format!("securevault_test_{}.db", uuid::Uuid::new_v4()));
        let db = Arc::new(Database::new(db_path).expect("create db"));
        VaultService::new(db)
    }

    #[test]
    fn metadata_encrypt_decrypt_compat() {
        let service = create_test_service();
        service.setup("Tester", "MasterPass#123456").expect("setup");
        let enc = service.encrypt_metadata("hello").expect("enc");
        assert!(enc.starts_with("enc::"));
        assert_eq!(service.decrypt_metadata_compat(&enc), "hello");
        assert_eq!(service.decrypt_metadata_compat("plain-text"), "plain-text");
    }

    #[test]
    fn create_account_with_expiry_persists() {
        let service = create_test_service();
        service.setup("Tester", "MasterPass#123456").expect("setup");

        let expires = Utc::now() + chrono::Duration::days(30);
        let created = service.create_account(
            "Expiring Account".to_string(),
            None,
            None,
            true,
            Some(expires.to_rfc3339()),
            vec![],
        ).expect("create");

        let got = service.get_account(&created.id).expect("get").expect("exists");
        assert!(got.has_expiry);
        assert!(got.expires_at.is_some());
    }
}
