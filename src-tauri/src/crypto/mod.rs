use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::utils::{AppError, AppResult};

const NONCE_SIZE: usize = 12;
const SALT_SIZE: usize = 32;
const KEY_SIZE: usize = 32;

pub struct CryptoService {
    master_key: Option<[u8; KEY_SIZE]>,
}

impl CryptoService {
    pub fn new() -> Self {
        Self { master_key: None }
    }

    pub fn derive_key(&self, password: &str, salt: &[u8]) -> AppResult<[u8; KEY_SIZE]> {
        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            argon2::Version::V0x13,
            argon2::Params::new(65536, 3, 4, Some(KEY_SIZE)).map_err(|e| AppError::Crypto(e.to_string()))?,
        );

        let mut key = [0u8; KEY_SIZE];
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .map_err(|e| AppError::Crypto(format!("Key derivation failed: {}", e)))?;

        Ok(key)
    }

    pub fn hash_password(&self, password: &str) -> AppResult<(String, String)> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            argon2::Version::V0x13,
            argon2::Params::new(65536, 3, 4, None).map_err(|e| AppError::Crypto(e.to_string()))?,
        );

        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AppError::Crypto(format!("Password hashing failed: {}", e)))?
            .to_string();

        Ok((hash, salt.to_string()))
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> AppResult<bool> {
        let parsed_hash = argon2::PasswordHash::new(hash)
            .map_err(|e| AppError::Crypto(format!("Invalid hash format: {}", e)))?;

        let argon2 = Argon2::default();
        Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
    }

    pub fn set_master_key(&mut self, key: [u8; KEY_SIZE]) {
        self.master_key = Some(key);
    }

    pub fn get_master_key(&self) -> Option<[u8; KEY_SIZE]> {
        self.master_key
    }

    pub fn clear_master_key(&mut self) {
        if let Some(mut key) = self.master_key {
            key.fill(0);
            self.master_key = None;
        }
    }

    pub fn has_master_key(&self) -> bool {
        self.master_key.is_some()
    }

    pub fn encrypt(&self, plaintext: &str) -> AppResult<(String, String)> {
        let key = self.master_key.ok_or(AppError::VaultLocked)?;

        let mut nonce_bytes = [0u8; NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| AppError::Crypto(format!("Invalid key: {}", e)))?;

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| AppError::Crypto(format!("Encryption failed: {}", e)))?;

        Ok((
            BASE64.encode(ciphertext),
            BASE64.encode(nonce_bytes),
        ))
    }

    pub fn decrypt(&self, ciphertext_b64: &str, nonce_b64: &str) -> AppResult<String> {
        let key = self.master_key.ok_or(AppError::VaultLocked)?;

        let ciphertext = BASE64
            .decode(ciphertext_b64)
            .map_err(|e| AppError::Crypto(format!("Invalid ciphertext: {}", e)))?;

        let nonce_bytes = BASE64
            .decode(nonce_b64)
            .map_err(|e| AppError::Crypto(format!("Invalid nonce: {}", e)))?;

        let nonce = Nonce::from_slice(&nonce_bytes);

        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| AppError::Crypto(format!("Invalid key: {}", e)))?;

        let plaintext = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| AppError::Crypto(format!("Decryption failed: {}", e)))?;

        String::from_utf8(plaintext).map_err(|e| AppError::Crypto(format!("Invalid UTF-8: {}", e)))
    }

    pub fn encrypt_bytes(&self, plaintext: &[u8]) -> AppResult<(Vec<u8>, Vec<u8>)> {
        let key = self.master_key.ok_or(AppError::VaultLocked)?;

        let mut nonce_bytes = [0u8; NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| AppError::Crypto(format!("Invalid key: {}", e)))?;

        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| AppError::Crypto(format!("Encryption failed: {}", e)))?;

        Ok((ciphertext, nonce_bytes.to_vec()))
    }

    pub fn decrypt_bytes(&self, ciphertext: &[u8], nonce_bytes: &[u8]) -> AppResult<Vec<u8>> {
        let key = self.master_key.ok_or(AppError::VaultLocked)?;

        let nonce = Nonce::from_slice(nonce_bytes);

        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| AppError::Crypto(format!("Invalid key: {}", e)))?;

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| AppError::Crypto(format!("Decryption failed: {}", e)))?;

        Ok(plaintext)
    }

    pub fn generate_salt() -> String {
        let mut salt = [0u8; SALT_SIZE];
        OsRng.fill_bytes(&mut salt);
        BASE64.encode(salt)
    }

    pub fn compute_hash(data: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        BASE64.encode(hasher.finalize())
    }
}

impl Default for CryptoService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_hash_and_verify() {
        let crypto = CryptoService::new();
        let (hash, _salt) = crypto.hash_password("StrongPass#123").expect("hash");
        assert!(crypto.verify_password("StrongPass#123", &hash).expect("verify"));
        assert!(!crypto.verify_password("WrongPass", &hash).expect("verify wrong"));
    }

    #[test]
    fn encrypt_and_decrypt_roundtrip() {
        let mut crypto = CryptoService::new();
        let salt = CryptoService::generate_salt();
        let salt_bytes = BASE64.decode(salt).expect("salt decode");
        let key = crypto.derive_key("MasterPass#123", &salt_bytes).expect("derive key");
        crypto.set_master_key(key);

        let (cipher, nonce) = crypto.encrypt("secret-value").expect("encrypt");
        let plain = crypto.decrypt(&cipher, &nonce).expect("decrypt");
        assert_eq!(plain, "secret-value");
    }
}
