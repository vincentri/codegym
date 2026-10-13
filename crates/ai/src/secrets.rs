//! API keys, keyed by AI profile id. The desktop app keeps them in the operating system's keychain
//! (macOS Keychain, Windows Credential Manager, the Secret Service on Linux); the Docker server
//! in a private file in its data volume. They are never written to SQLite and never sent to the UI.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub trait SecretStore: Send + Sync {
    fn get(&self, profile_id: &str) -> Result<Option<String>, String>;
    fn set(&self, profile_id: &str, secret: &str) -> Result<(), String>;
    fn delete(&self, profile_id: &str) -> Result<(), String>;
}

#[cfg(feature = "keychain")]
const SERVICE: &str = "com.codegym.app";

#[cfg(feature = "keychain")]
#[derive(Debug, Default)]
pub struct KeyringStore;

#[cfg(feature = "keychain")]
fn entry(profile_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, &format!("ai-profile:{profile_id}")).map_err(describe)
}

#[cfg(feature = "keychain")]
fn describe(e: keyring::Error) -> String {
    match e {
        keyring::Error::NoStorageAccess(_) | keyring::Error::PlatformFailure(_) => format!(
            "The system keychain isn't available ({e}). On Linux, install and unlock a Secret Service \
             keyring such as GNOME Keyring or KWallet."
        ),
        other => format!("Keychain error: {other}"),
    }
}

#[cfg(feature = "keychain")]
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

/// Keeps keys in a JSON file readable only by its owner. For the Docker server, where there is
/// no keychain; the file lives in the data volume next to the database.
#[derive(Debug)]
pub struct FileStore {
    path: PathBuf,
    lock: Mutex<()>,
}

impl FileStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into(), lock: Mutex::new(()) }
    }

    fn read(&self) -> Result<HashMap<String, String>, String> {
        match std::fs::read_to_string(&self.path) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{} is damaged: {e}", self.path.display())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
            Err(e) => Err(format!("Couldn't read {}: {e}", self.path.display())),
        }
    }

    fn write(&self, keys: &HashMap<String, String>) -> Result<(), String> {
        let tmp = self.path.with_extension("tmp");
        let json = serde_json::to_string_pretty(keys).map_err(|e| e.to_string())?;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let write = || -> std::io::Result<()> {
            use std::io::Write;
            options.open(&tmp)?.write_all(json.as_bytes())?;
            std::fs::rename(&tmp, &self.path)
        };
        write().map_err(|e| format!("Couldn't save {}: {e}", self.path.display()))
    }

    fn update(&self, f: impl FnOnce(&mut HashMap<String, String>)) -> Result<(), String> {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        let mut keys = self.read()?;
        f(&mut keys);
        self.write(&keys)
    }
}

impl SecretStore for FileStore {
    fn get(&self, profile_id: &str) -> Result<Option<String>, String> {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        Ok(self.read()?.remove(profile_id))
    }

    fn set(&self, profile_id: &str, secret: &str) -> Result<(), String> {
        self.update(|keys| {
            keys.insert(profile_id.into(), secret.into());
        })
    }

    fn delete(&self, profile_id: &str) -> Result<(), String> {
        self.update(|keys| {
            keys.remove(profile_id);
        })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_store_keeps_keys_private_and_survives_reopening() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("secrets.json");
        let store = FileStore::new(&path);
        assert_eq!(store.get("a").unwrap(), None);
        store.set("a", "sk-1").unwrap();
        store.set("b", "sk-2").unwrap();
        store.delete("b").unwrap();
        let reopened = FileStore::new(&path);
        assert_eq!(reopened.get("a").unwrap().as_deref(), Some("sk-1"));
        assert_eq!(reopened.get("b").unwrap(), None);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        }
    }
}
