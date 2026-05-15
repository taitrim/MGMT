use chrono::{DateTime, NaiveDateTime, Utc};
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::models::*;
use crate::utils::{AppError, AppResult};

pub struct Database {
    conn: Mutex<Connection>,
    path: PathBuf,
}

impl Database {
    pub fn new(path: PathBuf) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&path)?;

        let db = Self {
            conn: Mutex::new(conn),
            path: path.clone(),
        };

        db.initialize_schema()?;

        Ok(db)
    }

    pub fn get_path(&self) -> PathBuf {
        self.path.clone()
    }

    pub fn health_check(&self) -> AppResult<(bool, bool, i64)> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        let quick: String = conn.query_row("PRAGMA quick_check(1)", [], |row| row.get(0))?;
        let integrity: String = conn.query_row("PRAGMA integrity_check(1)", [], |row| row.get(0))?;
        let page_count: i64 = conn.query_row("PRAGMA page_count", [], |row| row.get(0))?;
        Ok((quick.eq_ignore_ascii_case("ok"), integrity.eq_ignore_ascii_case("ok"), page_count))
    }

    pub fn schema_fingerprint(&self) -> AppResult<String> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        let mut stmt = conn.prepare("SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL ORDER BY name")?;
        let mut rows = stmt.query([])?;
        let mut joined = String::new();
        while let Some(row) = rows.next()? {
            let sql: String = row.get(0)?;
            joined.push_str(&sql);
            joined.push('\n');
        }
        Ok(crate::crypto::CryptoService::compute_hash(&joined))
    }

    fn initialize_schema(&self) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT,
                display_name TEXT NOT NULL,
                master_key_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                failed_attempts INTEGER DEFAULT 0,
                locked_until TEXT
            );

            CREATE TABLE IF NOT EXISTS vaults (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                is_default INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                vault_id TEXT NOT NULL REFERENCES vaults(id),
                name TEXT NOT NULL,
                contact TEXT,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                is_deleted INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS account_types (
                id TEXT PRIMARY KEY,
                vault_id TEXT NOT NULL REFERENCES vaults(id),
                name TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                fields TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                is_builtin INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                vault_id TEXT NOT NULL REFERENCES vaults(id),
                customer_id TEXT REFERENCES customers(id),
                account_type_id TEXT REFERENCES account_types(id),
                name TEXT NOT NULL,
                favorite INTEGER DEFAULT 0,
                tags TEXT,
                has_expiry INTEGER DEFAULT 0,
                expires_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                deleted_at TEXT,
                is_deleted INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS field_values (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL REFERENCES accounts(id),
                field_key TEXT NOT NULL,
                field_type TEXT NOT NULL,
                value_encrypted TEXT NOT NULL,
                value_nonce TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                vault_id TEXT NOT NULL REFERENCES vaults(id),
                name TEXT NOT NULL,
                color TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL REFERENCES accounts(id),
                filename TEXT NOT NULL,
                mime_type TEXT,
                data_encrypted BLOB NOT NULL,
                data_nonce TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS totp_secrets (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL REFERENCES accounts(id),
                secret_encrypted TEXT NOT NULL,
                secret_nonce TEXT NOT NULL,
                algorithm TEXT DEFAULT 'SHA1',
                digits INTEGER DEFAULT 6,
                period INTEGER DEFAULT 30,
                issuer TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                details TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_accounts_vault ON accounts(vault_id);
            CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type_id);
            CREATE INDEX IF NOT EXISTS idx_customers_vault ON customers(vault_id);
            CREATE INDEX IF NOT EXISTS idx_field_values_account ON field_values(account_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
            "#,
        )?;

        let has_customer_id: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('accounts') WHERE name = 'customer_id'",
            [],
            |row| row.get(0),
        )?;
        if has_customer_id == 0 {
            conn.execute("ALTER TABLE accounts ADD COLUMN customer_id TEXT", [])?;
        }
        let has_has_expiry: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('accounts') WHERE name = 'has_expiry'",
            [],
            |row| row.get(0),
        )?;
        if has_has_expiry == 0 {
            conn.execute("ALTER TABLE accounts ADD COLUMN has_expiry INTEGER DEFAULT 0", [])?;
        }
        let has_expires_at: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('accounts') WHERE name = 'expires_at'",
            [],
            |row| row.get(0),
        )?;
        if has_expires_at == 0 {
            conn.execute("ALTER TABLE accounts ADD COLUMN expires_at TEXT", [])?;
        }
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_accounts_customer ON accounts(customer_id)",
            [],
        )?;

        // Migrate legacy SQLite datetime strings (`YYYY-MM-DD HH:MM:SS`) to RFC3339
        // so old data doesn't trigger parsing panics.
        conn.execute_batch(
            r#"
            UPDATE users SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at NOT LIKE '%T%';
            UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at NOT LIKE '%T%';
            UPDATE users SET locked_until = strftime('%Y-%m-%dT%H:%M:%SZ', locked_until) WHERE locked_until IS NOT NULL AND locked_until NOT LIKE '%T%';
            UPDATE vaults SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at NOT LIKE '%T%';
            UPDATE vaults SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at NOT LIKE '%T%';
            UPDATE account_types SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at NOT LIKE '%T%';
            UPDATE accounts SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at NOT LIKE '%T%';
            UPDATE accounts SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) WHERE updated_at NOT LIKE '%T%';
            UPDATE accounts SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', deleted_at) WHERE deleted_at IS NOT NULL AND deleted_at NOT LIKE '%T%';
            UPDATE accounts SET expires_at = strftime('%Y-%m-%dT%H:%M:%SZ', expires_at) WHERE expires_at IS NOT NULL AND expires_at NOT LIKE '%T%';
            UPDATE audit_logs SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at NOT LIKE '%T%';
            UPDATE totp_secrets SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at NOT LIKE '%T%';
            UPDATE attachments SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at) WHERE created_at NOT LIKE '%T%';
            "#
        )?;

        Ok(())
    }

    pub fn seed_builtin_types_for_vault(&self, vault_id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        // Compatibility path for older builds that seeded builtins into a legacy vault id.
        conn.execute(
            "UPDATE account_types SET vault_id = ?1 WHERE is_builtin = 1 AND vault_id = 'default-vault'",
            params![vault_id],
        )?;

        let builtin_types = vec![
            ("server", "Server", "server", "#10b981", vec![
                ("hostname", "Hostname", "text", true, true),
                ("port", "Port", "number", false, false),
                ("username", "Username", "text", true, true),
                ("password", "Password", "password", true, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("ssh", "SSH", "terminal", "#6366f1", vec![
                ("hostname", "Hostname", "text", true, true),
                ("port", "Port", "number", false, false),
                ("username", "Username", "text", true, true),
                ("private_key", "Private Key", "sshkey", true, true),
                ("passphrase", "Passphrase", "password", false, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("rdp", "RDP", "monitor", "#f59e0b", vec![
                ("hostname", "Hostname", "text", true, true),
                ("port", "Port", "number", false, false),
                ("username", "Username", "text", true, true),
                ("password", "Password", "password", true, true),
                ("domain", "Domain", "text", false, false),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("database", "Database", "database", "#ef4444", vec![
                ("host", "Host", "text", true, true),
                ("port", "Port", "number", false, false),
                ("database_name", "Database Name", "text", true, true),
                ("username", "Username", "text", true, true),
                ("password", "Password", "password", true, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("website", "Website", "globe", "#3b82f6", vec![
                ("url", "URL", "url", true, false),
                ("username", "Username", "text", true, true),
                ("password", "Password", "password", true, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("hosting", "Hosting", "cloud", "#8b5cf6", vec![
                ("provider", "Provider", "text", true, false),
                ("url", "Panel URL", "url", false, false),
                ("username", "Username", "text", true, true),
                ("password", "Password", "password", true, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("cloud", "Cloud", "cloud", "#06b6d4", vec![
                ("provider", "Provider", "text", true, false),
                ("email", "Email", "email", true, true),
                ("api_key", "API Key", "password", false, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("vpn", "VPN", "lock", "#ec4899", vec![
                ("provider", "Provider", "text", true, false),
                ("config", "Config", "textarea", false, true),
                ("username", "Username", "text", true, true),
                ("password", "Password", "password", true, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("ftp", "FTP/SFTP", "folder", "#84cc16", vec![
                ("hostname", "Hostname", "text", true, true),
                ("port", "Port", "number", false, false),
                ("username", "Username", "text", true, true),
                ("password", "Password", "password", true, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("email", "Email", "mail", "#14b8a6", vec![
                ("email", "Email", "email", true, true),
                ("password", "Password", "password", true, true),
                ("smtp_server", "SMTP Server", "text", false, false),
                ("smtp_port", "SMTP Port", "number", false, false),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("outlook", "Outlook", "mail", "#2563eb", vec![
                ("email", "Email", "email", true, true),
                ("password", "Password", "password", true, true),
                ("tenant", "Tenant", "text", false, false),
                ("app_password", "App Password", "password", false, true),
                ("recovery_email", "Recovery Email", "email", false, false),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("router", "Router", "network", "#22c55e", vec![
                ("brand", "Brand", "text", false, false),
                ("model", "Model", "text", false, false),
                ("ip_address", "IP Address", "text", true, false),
                ("admin_username", "Admin Username", "text", true, true),
                ("admin_password", "Admin Password", "password", true, true),
                ("wifi_ssid", "WiFi SSID", "text", false, false),
                ("wifi_password", "WiFi Password", "password", false, true),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("api", "API Token", "key", "#f97316", vec![
                ("name", "Name", "text", true, false),
                ("api_key", "API Key", "password", true, true),
                ("endpoint", "Endpoint", "url", false, false),
                ("notes", "Notes", "textarea", false, true),
            ]),
            ("license", "License Key", "file-key", "#eab308", vec![
                ("product", "Product", "text", true, false),
                ("license_key", "License Key", "password", true, true),
                ("email", "Email", "email", false, false),
                ("expiry", "Expiry Date", "date", false, false),
                ("notes", "Notes", "textarea", false, true),
            ]),
        ];

        for (id, name, icon, color, fields) in builtin_types {
            let fields_json = serde_json::json!({
                "fields": fields.iter().map(|(key, display, ftype, required, encrypted)| {
                    serde_json::json!({
                        "key": key,
                        "name": display,
                        "fieldType": ftype,
                        "required": required,
                        "encrypted": encrypted
                    })
                }).collect::<Vec<_>>()
            });

            conn.execute(
                "INSERT OR IGNORE INTO account_types (id, vault_id, name, icon, color, fields, created_at, is_builtin) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
                params![id, vault_id, name, icon, color, fields_json.to_string(), Utc::now().to_rfc3339()],
            )?;
        }

        Ok(())
    }

    pub fn create_user(&self, user: &User) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "INSERT INTO users (id, email, display_name, master_key_hash, salt, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                user.id,
                user.email,
                user.display_name,
                user.master_key_hash,
                user.salt,
                user.created_at.to_rfc3339(),
                user.updated_at.to_rfc3339()
            ],
        )?;

        Ok(())
    }

    pub fn get_users(&self) -> AppResult<Vec<User>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, email, display_name, master_key_hash, salt, created_at, updated_at, failed_attempts, locked_until FROM users"
        )?;

        let users = stmt.query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                email: row.get(1)?,
                display_name: row.get(2)?,
                master_key_hash: row.get(3)?,
                salt: row.get(4)?,
                created_at: parse_datetime(&row.get::<_, String>(5)?),
                updated_at: parse_datetime(&row.get::<_, String>(6)?),
                failed_attempts: row.get(7)?,
                locked_until: parse_optional_datetime(row.get::<_, Option<String>>(8)?),
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(users)
    }

    pub fn get_user(&self, id: &str) -> AppResult<Option<User>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, email, display_name, master_key_hash, salt, created_at, updated_at, failed_attempts, locked_until FROM users WHERE id = ?1"
        )?;

        let user = stmt.query_row(params![id], |row| {
            Ok(User {
                id: row.get(0)?,
                email: row.get(1)?,
                display_name: row.get(2)?,
                master_key_hash: row.get(3)?,
                salt: row.get(4)?,
                created_at: parse_datetime(&row.get::<_, String>(5)?),
                updated_at: parse_datetime(&row.get::<_, String>(6)?),
                failed_attempts: row.get(7)?,
                locked_until: parse_optional_datetime(row.get::<_, Option<String>>(8)?),
            })
        }).optional()?;

        Ok(user)
    }

    pub fn get_user_by_email(&self, email: &str) -> AppResult<Option<User>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, email, display_name, master_key_hash, salt, created_at, updated_at, failed_attempts, locked_until FROM users WHERE email = ?1"
        )?;

        let user = stmt.query_row(params![email], |row| {
            Ok(User {
                id: row.get(0)?,
                email: row.get(1)?,
                display_name: row.get(2)?,
                master_key_hash: row.get(3)?,
                salt: row.get(4)?,
                created_at: parse_datetime(&row.get::<_, String>(5)?),
                updated_at: parse_datetime(&row.get::<_, String>(6)?),
                failed_attempts: row.get(7)?,
                locked_until: parse_optional_datetime(row.get::<_, Option<String>>(8)?),
            })
        }).optional()?;

        Ok(user)
    }

    pub fn update_user_failed_attempts(&self, user_id: &str, attempts: i32, locked_until: Option<chrono::DateTime<chrono::Utc>>) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "UPDATE users SET failed_attempts = ?1, locked_until = ?2 WHERE id = ?3",
            params![attempts, locked_until.map(|dt| dt.to_rfc3339()), user_id],
        )?;

        Ok(())
    }

    pub fn create_vault(&self, vault: &Vault) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "INSERT INTO vaults (id, user_id, name, description, created_at, updated_at, is_default) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                vault.id,
                vault.user_id,
                vault.name,
                vault.description,
                vault.created_at.to_rfc3339(),
                vault.updated_at.to_rfc3339(),
                vault.is_default as i32
            ],
        )?;
        drop(conn);

        self.seed_builtin_types_for_vault(&vault.id)?;

        Ok(())
    }

    pub fn get_vaults(&self, user_id: &str) -> AppResult<Vec<Vault>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, description, created_at, updated_at, is_default FROM vaults WHERE user_id = ?1"
        )?;

        let vaults = stmt.query_map(params![user_id], |row| {
            Ok(Vault {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                created_at: parse_datetime(&row.get::<_, String>(4)?),
                updated_at: parse_datetime(&row.get::<_, String>(5)?),
                is_default: row.get::<_, i32>(6)? != 0,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(vaults)
    }

    pub fn get_default_vault(&self, user_id: &str) -> AppResult<Option<Vault>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, description, created_at, updated_at, is_default FROM vaults WHERE user_id = ?1 AND is_default = 1"
        )?;

        let vault = stmt.query_row(params![user_id], |row| {
            Ok(Vault {
                id: row.get(0)?,
                user_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                created_at: parse_datetime(&row.get::<_, String>(4)?),
                updated_at: parse_datetime(&row.get::<_, String>(5)?),
                is_default: row.get::<_, i32>(6)? != 0,
            })
        }).optional()?;

        Ok(vault)
    }

    pub fn create_account(&self, account: &Account) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "INSERT INTO accounts (id, vault_id, customer_id, account_type_id, name, favorite, tags, has_expiry, expires_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                account.id,
                account.vault_id,
                account.customer_id,
                account.account_type_id,
                account.name,
                account.favorite as i32,
                serde_json::to_string(&account.tags)?,
                account.has_expiry as i32,
                account.expires_at.map(|d| d.to_rfc3339()),
                account.created_at.to_rfc3339(),
                account.updated_at.to_rfc3339()
            ],
        )?;

        Ok(())
    }

    pub fn get_accounts(&self, vault_id: &str) -> AppResult<Vec<Account>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, vault_id, customer_id, account_type_id, name, favorite, tags, has_expiry, expires_at, created_at, updated_at, deleted_at, is_deleted FROM accounts WHERE vault_id = ?1 AND is_deleted = 0"
        )?;

        let accounts = stmt.query_map(params![vault_id], |row| {
            let tags_str: String = row.get(6)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();

            Ok(Account {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                customer_id: row.get(2)?,
                account_type_id: row.get(3)?,
                name: row.get(4)?,
                favorite: row.get::<_, i32>(5)? != 0,
                tags,
                has_expiry: row.get::<_, i32>(7)? != 0,
                expires_at: parse_optional_datetime(row.get::<_, Option<String>>(8)?),
                created_at: parse_datetime(&row.get::<_, String>(9)?),
                updated_at: parse_datetime(&row.get::<_, String>(10)?),
                deleted_at: parse_optional_datetime(row.get::<_, Option<String>>(11)?),
                is_deleted: row.get::<_, i32>(12)? != 0,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(accounts)
    }

    pub fn get_account(&self, id: &str) -> AppResult<Option<Account>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, vault_id, customer_id, account_type_id, name, favorite, tags, has_expiry, expires_at, created_at, updated_at, deleted_at, is_deleted FROM accounts WHERE id = ?1 AND is_deleted = 0"
        )?;

        let account = stmt.query_row(params![id], |row| {
            let tags_str: String = row.get(6)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();

            Ok(Account {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                customer_id: row.get(2)?,
                account_type_id: row.get(3)?,
                name: row.get(4)?,
                favorite: row.get::<_, i32>(5)? != 0,
                tags,
                has_expiry: row.get::<_, i32>(7)? != 0,
                expires_at: parse_optional_datetime(row.get::<_, Option<String>>(8)?),
                created_at: parse_datetime(&row.get::<_, String>(9)?),
                updated_at: parse_datetime(&row.get::<_, String>(10)?),
                deleted_at: parse_optional_datetime(row.get::<_, Option<String>>(11)?),
                is_deleted: row.get::<_, i32>(12)? != 0,
            })
        }).optional()?;

        Ok(account)
    }

    pub fn update_account(&self, account: &Account) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "UPDATE accounts SET name = ?1, customer_id = ?2, favorite = ?3, tags = ?4, has_expiry = ?5, expires_at = ?6, updated_at = ?7 WHERE id = ?8",
            params![
                account.name,
                account.customer_id,
                account.favorite as i32,
                serde_json::to_string(&account.tags)?,
                account.has_expiry as i32,
                account.expires_at.map(|d| d.to_rfc3339()),
                chrono::Utc::now().to_rfc3339(),
                account.id
            ],
        )?;

        Ok(())
    }

    pub fn delete_account(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "UPDATE accounts SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2",
            params![chrono::Utc::now().to_rfc3339(), id],
        )?;

        Ok(())
    }

    pub fn save_field_value(&self, field: &FieldValue, encrypted_value: &str, nonce: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let existing: Option<String> = conn.query_row(
            "SELECT id FROM field_values WHERE account_id = ?1 AND field_key = ?2",
            params![field.account_id, field.field_key],
            |row| row.get(0),
        ).optional()?;

        if let Some(id) = existing {
            conn.execute(
                "UPDATE field_values SET value_encrypted = ?1, value_nonce = ?2, updated_at = ?3 WHERE id = ?4",
                params![encrypted_value, nonce, chrono::Utc::now().to_rfc3339(), id],
            )?;
        } else {
            conn.execute(
                "INSERT INTO field_values (id, account_id, field_key, field_type, value_encrypted, value_nonce) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    field.account_id,
                    field.field_key,
                    serde_json::to_string(&field.field_type)?,
                    encrypted_value,
                    nonce
                ],
            )?;
        }

        Ok(())
    }

    pub fn get_field_values(&self, account_id: &str) -> AppResult<Vec<(String, String, String, String)>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT field_key, field_type, value_encrypted, value_nonce FROM field_values WHERE account_id = ?1"
        )?;

        let values = stmt.query_map(params![account_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(values)
    }

    pub fn get_account_type(&self, id: &str) -> AppResult<Option<AccountType>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, vault_id, name, icon, color, fields, created_at, is_builtin, is_deleted FROM account_types WHERE id = ?1 AND is_deleted = 0"
        )?;

        let account_type = stmt.query_row(params![id], |row| {
            let fields_str: String = row.get(5)?;
            let fields: Vec<FieldDefinition> = serde_json::from_str(&fields_str)
                .unwrap_or_else(|_| {
                    let parsed: serde_json::Value = serde_json::from_str(&fields_str).unwrap_or_default();
                    if let Some(fields_arr) = parsed.get("fields").and_then(|f| f.as_array()) {
                        fields_arr.iter().filter_map(|f| {
                            Some(FieldDefinition {
                                key: f.get("key")?.as_str()?.to_string(),
                                name: f.get("name")?.as_str()?.to_string(),
                                field_type: match f.get("fieldType").and_then(|t| t.as_str()) {
                                    Some("password") => FieldType::Password,
                                    Some("textarea") => FieldType::Textarea,
                                    Some("url") => FieldType::Url,
                                    Some("number") => FieldType::Number,
                                    Some("email") => FieldType::Email,
                                    Some("date") => FieldType::Date,
                                    Some("checkbox") => FieldType::Checkbox,
                                    _ => FieldType::Text,
                                },
                                required: f.get("required").and_then(|r| r.as_bool()).unwrap_or(false),
                                encrypted: f.get("encrypted").and_then(|e| e.as_bool()).unwrap_or(true),
                                options: None,
                            })
                        }).collect()
                    } else {
                        Vec::new()
                    }
                });

            Ok(AccountType {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                name: row.get(2)?,
                icon: row.get(3)?,
                color: row.get(4)?,
                fields,
                created_at: parse_datetime(&row.get::<_, String>(6)?),
                is_builtin: row.get::<_, i32>(7)? != 0,
                is_deleted: row.get::<_, i32>(8)? != 0,
            })
        }).optional()?;

        Ok(account_type)
    }

    pub fn get_account_types(&self, vault_id: &str) -> AppResult<Vec<AccountType>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, vault_id, name, icon, color, fields, created_at, is_builtin, is_deleted FROM account_types WHERE vault_id = ?1 AND is_deleted = 0"
        )?;

        let types = stmt.query_map(params![vault_id], |row| {
            let fields_str: String = row.get(5)?;
            let fields: Vec<FieldDefinition> = serde_json::from_str(&fields_str).unwrap_or_else(|_| {
                let parsed: serde_json::Value = serde_json::from_str(&fields_str).unwrap_or_default();
                if let Some(fields_arr) = parsed.get("fields").and_then(|f| f.as_array()) {
                    fields_arr.iter().filter_map(|f| {
                        Some(FieldDefinition {
                            key: f.get("key")?.as_str()?.to_string(),
                            name: f.get("name")?.as_str()?.to_string(),
                            field_type: match f.get("fieldType").and_then(|t| t.as_str()) {
                                Some("password") => FieldType::Password,
                                Some("textarea") => FieldType::Textarea,
                                Some("url") => FieldType::Url,
                                Some("number") => FieldType::Number,
                                Some("email") => FieldType::Email,
                                Some("date") => FieldType::Date,
                                Some("checkbox") => FieldType::Checkbox,
                                Some("sshkey") => FieldType::SshKey,
                                Some("totp") => FieldType::Totp,
                                _ => FieldType::Text,
                            },
                            required: f.get("required").and_then(|r| r.as_bool()).unwrap_or(false),
                            encrypted: f.get("encrypted").and_then(|e| e.as_bool()).unwrap_or(true),
                            options: None,
                        })
                    }).collect()
                } else {
                    Vec::new()
                }
            });

            Ok(AccountType {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                name: row.get(2)?,
                icon: row.get(3)?,
                color: row.get(4)?,
                fields,
                created_at: parse_datetime(&row.get::<_, String>(6)?),
                is_builtin: row.get::<_, i32>(7)? != 0,
                is_deleted: row.get::<_, i32>(8)? != 0,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(types)
    }

    pub fn create_account_type(&self, account_type: &AccountType) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "INSERT INTO account_types (id, vault_id, name, icon, color, fields, created_at, is_builtin) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                account_type.id,
                account_type.vault_id,
                account_type.name,
                account_type.icon,
                account_type.color,
                serde_json::to_string(&account_type.fields)?,
                account_type.created_at.to_rfc3339(),
                account_type.is_builtin as i32
            ],
        )?;

        Ok(())
    }

    pub fn update_account_type(&self, account_type: &AccountType) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        let fields_json = serde_json::to_string(&account_type.fields)?;

        conn.execute(
            "UPDATE account_types SET name = ?1, icon = ?2, color = ?3, fields = ?4 WHERE id = ?5",
            params![account_type.name, account_type.icon, account_type.color, fields_json, account_type.id],
        )?;
        Ok(())
    }

    pub fn delete_account_type(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        conn.execute(
            "UPDATE account_types SET is_deleted = 1 WHERE id = ?1 AND is_builtin = 0",
            params![id],
        )?;
        Ok(())
    }

    pub fn get_account_type_field_usage_count(&self, account_type_id: &str, field_key: &str) -> AppResult<i64> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        let count: i64 = conn.query_row(
            r#"
            SELECT COUNT(*)
            FROM field_values fv
            JOIN accounts a ON a.id = fv.account_id
            WHERE a.account_type_id = ?1
              AND a.is_deleted = 0
              AND fv.field_key = ?2
            "#,
            params![account_type_id, field_key],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn search_accounts(&self, vault_id: &str, query: &str) -> AppResult<Vec<Account>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let search_pattern = format!("%{}%", query.to_lowercase());

        let mut stmt = conn.prepare(
            "SELECT id, vault_id, customer_id, account_type_id, name, favorite, tags, has_expiry, expires_at, created_at, updated_at, deleted_at, is_deleted FROM accounts WHERE vault_id = ?1 AND is_deleted = 0 AND LOWER(name) LIKE ?2"
        )?;

        let accounts = stmt.query_map(params![vault_id, search_pattern], |row| {
            let tags_str: String = row.get(6)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();

            Ok(Account {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                customer_id: row.get(2)?,
                account_type_id: row.get(3)?,
                name: row.get(4)?,
                favorite: row.get::<_, i32>(5)? != 0,
                tags,
                has_expiry: row.get::<_, i32>(7)? != 0,
                expires_at: parse_optional_datetime(row.get::<_, Option<String>>(8)?),
                created_at: parse_datetime(&row.get::<_, String>(9)?),
                updated_at: parse_datetime(&row.get::<_, String>(10)?),
                deleted_at: parse_optional_datetime(row.get::<_, Option<String>>(11)?),
                is_deleted: row.get::<_, i32>(12)? != 0,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(accounts)
    }

    pub fn get_vault_stats(&self, vault_id: &str) -> AppResult<VaultStats> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let total_accounts: i64 = conn.query_row(
            "SELECT COUNT(*) FROM accounts WHERE vault_id = ?1 AND is_deleted = 0",
            params![vault_id],
            |row| row.get(0),
        )?;

        let favorite_accounts: i64 = conn.query_row(
            "SELECT COUNT(*) FROM accounts WHERE vault_id = ?1 AND is_deleted = 0 AND favorite = 1",
            params![vault_id],
            |row| row.get(0),
        )?;

        let account_types: i64 = conn.query_row(
            "SELECT COUNT(*) FROM account_types WHERE vault_id = ?1 AND is_deleted = 0",
            params![vault_id],
            |row| row.get(0),
        )?;

        let tags: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tags WHERE vault_id = ?1",
            params![vault_id],
            |row| row.get(0),
        )?;

        let attachments: i64 = conn.query_row(
            "SELECT COUNT(*) FROM attachments a JOIN accounts ac ON a.account_id = ac.id WHERE ac.vault_id = ?1 AND ac.is_deleted = 0",
            params![vault_id],
            |row| row.get(0),
        )?;

        Ok(VaultStats {
            total_accounts,
            favorite_accounts,
            account_types,
            tags,
            attachments,
        })
    }

    pub fn add_audit_log(&self, log: &AuditLog) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                log.id,
                log.user_id,
                log.action,
                log.target_type,
                log.target_id,
                log.details.clone().map(|d| d.to_string()),
                log.created_at.to_rfc3339()
            ],
        )?;

        Ok(())
    }

    pub fn get_audit_logs(&self, user_id: &str, limit: i64) -> AppResult<Vec<AuditLog>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, user_id, action, target_type, target_id, details, created_at FROM audit_logs WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2"
        )?;

        let logs = stmt.query_map(params![user_id, limit], |row| {
            Ok(AuditLog {
                id: row.get(0)?,
                user_id: row.get(1)?,
                action: row.get(2)?,
                target_type: row.get(3)?,
                target_id: row.get(4)?,
                details: row.get::<_, Option<String>>(5)?.map(|s| serde_json::from_str(&s).unwrap_or_default()),
                created_at: parse_datetime(&row.get::<_, String>(6)?),
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(logs)
    }

    pub fn save_totp_secret(&self, totp: &TotpSecret, encrypted_secret: &str, nonce: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "INSERT OR REPLACE INTO totp_secrets (id, account_id, secret_encrypted, secret_nonce, algorithm, digits, period, issuer, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                totp.id,
                totp.account_id,
                encrypted_secret,
                nonce,
                totp.algorithm,
                totp.digits,
                totp.period,
                totp.issuer,
                totp.created_at.to_rfc3339()
            ],
        )?;

        Ok(())
    }

    pub fn get_totp_secret(&self, account_id: &str) -> AppResult<Option<(String, String, String, i32, i32, Option<String>)>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT secret_encrypted, secret_nonce, algorithm, digits, period, issuer FROM totp_secrets WHERE account_id = ?1"
        )?;

        let result = stmt.query_row(params![account_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
        }).optional()?;

        Ok(result)
    }

    pub fn save_attachment(&self, attachment: &Attachment, encrypted_data: &[u8], nonce: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        conn.execute(
            "INSERT INTO attachments (id, account_id, filename, mime_type, data_encrypted, data_nonce, size, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                attachment.id,
                attachment.account_id,
                attachment.filename,
                attachment.mime_type,
                encrypted_data,
                nonce,
                attachment.size,
                attachment.created_at.to_rfc3339()
            ],
        )?;

        Ok(())
    }

    pub fn get_attachments(&self, account_id: &str) -> AppResult<Vec<Attachment>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let mut stmt = conn.prepare(
            "SELECT id, account_id, filename, mime_type, size, created_at FROM attachments WHERE account_id = ?1"
        )?;

        let attachments = stmt.query_map(params![account_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                account_id: row.get(1)?,
                filename: row.get(2)?,
                mime_type: row.get(3)?,
                data: Vec::new(), // Don't load data here
                size: row.get(4)?,
                created_at: parse_datetime(&row.get::<_, String>(5)?),
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(attachments)
    }

    pub fn get_attachment_data(&self, id: &str) -> AppResult<Option<(Vec<u8>, String)>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;

        let result = conn.query_row(
            "SELECT data_encrypted, data_nonce FROM attachments WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).optional()?;

        Ok(result)
    }

    pub fn create_customer(&self, customer: &Customer) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        conn.execute(
            "INSERT INTO customers (id, vault_id, name, contact, notes, created_at, is_deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                customer.id,
                customer.vault_id,
                customer.name,
                customer.contact,
                customer.notes,
                customer.created_at.to_rfc3339(),
                customer.is_deleted as i32
            ],
        )?;
        Ok(())
    }

    pub fn get_customers(&self, vault_id: &str) -> AppResult<Vec<Customer>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        let mut stmt = conn.prepare(
            "SELECT id, vault_id, name, contact, notes, created_at, is_deleted FROM customers WHERE vault_id = ?1 AND is_deleted = 0 ORDER BY name COLLATE NOCASE"
        )?;

        let customers = stmt.query_map(params![vault_id], |row| {
            Ok(Customer {
                id: row.get(0)?,
                vault_id: row.get(1)?,
                name: row.get(2)?,
                contact: row.get(3)?,
                notes: row.get(4)?,
                created_at: parse_datetime(&row.get::<_, String>(5)?),
                is_deleted: row.get::<_, i32>(6)? != 0,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(customers)
    }

    pub fn delete_customer(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        conn.execute(
            "UPDATE customers SET is_deleted = 1 WHERE id = ?1",
            params![id],
        )?;
        // Unlink accounts from deleted customer to keep data accessible.
        conn.execute(
            "UPDATE accounts SET customer_id = NULL WHERE customer_id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn update_customer_sensitive(&self, id: &str, contact: Option<String>, notes: Option<String>) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?;
        conn.execute(
            "UPDATE customers SET contact = ?1, notes = ?2 WHERE id = ?3",
            params![contact, notes, id],
        )?;
        Ok(())
    }
}

fn parse_datetime(raw: &str) -> DateTime<Utc> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(raw) {
        return dt.with_timezone(&Utc);
    }

    if let Ok(naive) = NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S") {
        return DateTime::from_naive_utc_and_offset(naive, Utc);
    }

    Utc::now()
}

fn parse_optional_datetime(raw: Option<String>) -> Option<DateTime<Utc>> {
    raw.as_deref().map(parse_datetime)
}

trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

