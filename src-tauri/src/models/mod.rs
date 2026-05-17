use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: Option<String>,
    pub display_name: String,
    pub master_key_hash: String,
    pub salt: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub failed_attempts: i32,
    pub locked_until: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountType {
    pub id: String,
    pub vault_id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub fields: Vec<FieldDefinition>,
    pub created_at: DateTime<Utc>,
    pub is_builtin: bool,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDefinition {
    pub key: String,
    pub name: String,
    pub field_type: FieldType,
    pub required: bool,
    pub encrypted: bool,
    pub options: Option<Vec<String>>,
    #[serde(default)]
    pub field_group: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    Text,
    Textarea,
    Password,
    Url,
    Number,
    Checkbox,
    Date,
    Email,
    Select,
    MultiSelect,
    Tags,
    File,
    Totp,
    SshKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub vault_id: String,
    pub customer_id: Option<String>,
    pub account_type_id: Option<String>,
    pub name: String,
    pub favorite: bool,
    pub tags: Vec<String>,
    pub has_expiry: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub updated_by_access_user_id: Option<String>,
    pub updated_by_access_user_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Customer {
    pub id: String,
    pub vault_id: String,
    pub name: String,
    pub contact: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldValue {
    pub id: String,
    pub account_id: String,
    pub field_key: String,
    pub field_type: FieldType,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub vault_id: String,
    pub name: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub account_id: String,
    pub filename: String,
    pub mime_type: Option<String>,
    pub data: Vec<u8>,
    pub size: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TotpSecret {
    pub id: String,
    pub account_id: String,
    pub secret: String,
    pub algorithm: String,
    pub digits: i32,
    pub period: i32,
    pub issuer: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    pub user_id: String,
    pub action: String,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub details: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStats {
    pub total_accounts: i64,
    pub favorite_accounts: i64,
    pub account_types: i64,
    pub tags: i64,
    pub attachments: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessUser {
    pub id: String,
    pub vault_id: String,
    pub name: String,
    pub email: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub category_permissions: Vec<String>,
    pub can_view_password: bool,
    pub can_create_account: bool,
    pub created_at: DateTime<Utc>,
}

impl User {
    pub fn new(display_name: String, master_key_hash: String, salt: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            email: None,
            display_name,
            master_key_hash,
            salt,
            created_at: now,
            updated_at: now,
            failed_attempts: 0,
            locked_until: None,
        }
    }
}

impl Vault {
    pub fn new(user_id: String, name: String, is_default: bool) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            user_id,
            name,
            description: None,
            created_at: now,
            updated_at: now,
            is_default,
        }
    }
}

impl Account {
    pub fn new(vault_id: String, name: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            vault_id,
            customer_id: None,
            account_type_id: None,
            name,
            favorite: false,
            tags: Vec::new(),
            has_expiry: false,
            expires_at: None,
            updated_by_access_user_id: None,
            updated_by_access_user_name: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            is_deleted: false,
        }
    }
}
