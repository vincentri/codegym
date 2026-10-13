//! API keys live in the operating system's keychain (macOS Keychain, Windows Credential Manager,
//! the Secret Service on Linux), keyed by AI profile id. They are never written to SQLite and
//! never sent to the UI.

use std::collections::HashMap;
use std::sync::Mutex;

pub trait SecretStore: Send + Sync {
    fn get(&self, profile_id: &str) -> Result<Option<String>, String>;
    fn set(&self, profile_id: &str, secret: &str) -> Result<(), String>;
    fn delete(&self, profile_id: &str) -> Result<(), String>;
}

const SERVICE: &str = "com.codegym.app";

#[derive(Debug, Default)]
pub struct KeyringStore;

fn entry(profile_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, &format!("ai-profile:{profile_id}")).map_err(describe)
}

fn describe(e: keyring::Error) -> String {
    match e {
        keyring::Error::NoStorageAccess(_) | keyring::Error::PlatformFailure(_) => format!(
            "The system keychain isn't available ({e}). On Linux, install and unlock a Secret Service \
             keyring such as GNOME Keyring or KWallet."
        ),
        other => format!("Keychain error: {other}"),
    }
}

impl SecretStore for KeyringStore {
    fn get(&self, profile_id: &str) -> Result<Option<String>, String> {
        match entry(profile_id)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(describe(e)),
        }
    }

    fn set(&self, profile_id: &str, secret: &str) -> Result<(), String> {
        entry(profile_id)?.set_password(secret).map_err(describe)
    }

    fn delete(&self, profile_id: &str) -> Result<(), String> {
        match entry(profile_id)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(describe(e)),
        }
    }
}

/// Keeps keys in memory; for tests.
#[derive(Debug, Default)]
pub struct MemoryStore(Mutex<HashMap<String, String>>);

impl SecretStore for MemoryStore {
    fn get(&self, profile_id: &str) -> Result<Option<String>, String> {
        Ok(self.0.lock().unwrap_or_else(|e| e.into_inner()).get(profile_id).cloned())
    }

    fn set(&self, profile_id: &str, secret: &str) -> Result<(), String> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).insert(profile_id.into(), secret.into());
        Ok(())
    }

    fn delete(&self, profile_id: &str) -> Result<(), String> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).remove(profile_id);
        Ok(())
    }
}
