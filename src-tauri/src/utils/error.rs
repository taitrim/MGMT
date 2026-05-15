use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Vault locked")]
    VaultLocked,

    #[error("Invalid master password")]
    InvalidPassword,

    #[error("Account not found: {0}")]
    AccountNotFound(String),

    #[error("Vault not found: {0}")]
    VaultNotFound(String),

    #[error("Field not found: {0}")]
    FieldNotFound(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("TOTP error: {0}")]
    Totp(String),

    #[error("Backup error: {0}")]
    Backup(String),

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),

    #[error("Brute force protection: account locked for {0} seconds")]
    BruteForceProtection(u64),

    #[error("Session expired")]
    SessionExpired,
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;