//! Local SQLite store. Every user-facing operation in the app goes through here.

mod plans;
mod problems;
mod progress;

use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension, params};
use rusqlite_migration::{M, Migrations};
use serde::{Serialize, de::DeserializeOwned};

use crate::types::{AiProfile, AiProfileForm, AppSettings, ChatMessage, DataInfo, Draft, Language};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("database migration failed: {0}")]
    Migration(#[from] rusqlite_migration::Error),
    #[error("stored data is corrupt: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0} not found")]
    NotFound(String),
    #[error("{0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, StoreError>;

pub(crate) fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub(crate) fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub(crate) fn slugify(s: &str) -> String {
    let mut out = String::new();
    for c in s.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    out.trim_end_matches('-').to_string()
}

pub(crate) fn to_json<T: Serialize>(v: &T) -> Result<String> {
    Ok(serde_json::to_string(v)?)
}

pub(crate) fn from_json<T: DeserializeOwned>(s: &str) -> Result<T> {
    Ok(serde_json::from_str(s)?)
}

pub(crate) fn parse_language(s: &str) -> Language {
    Language::parse(s).unwrap_or(Language::Python)
}

fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(include_str!("schema.sql"))])
}

pub struct Store {
    conn: Connection,
    path: Option<PathBuf>,
}

impl Store {
    /// Opens (or creates) the database file and brings the schema and built-in bank up to date.
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)
                .map_err(|e| StoreError::Invalid(format!("can't create {}: {e}", dir.display())))?;
        }
        Self::init(Connection::open(path)?, Some(path.to_path_buf()))
    }

    /// A throwaway database, used by tests.
    pub fn open_in_memory() -> Result<Self> {
        Self::init(Connection::open_in_memory()?, None)
    }

    fn init(mut conn: Connection, path: Option<PathBuf>) -> Result<Self> {
        conn.pragma_update(None, "foreign_keys", true)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        migrations().to_latest(&mut conn)?;
        let mut store = Self { conn, path };
        store.sync_bank()?;
        Ok(store)
    }

    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    // --- settings ----------------------------------------------------------------

    fn setting<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let raw: Option<String> =
            self.conn.query_row("SELECT value_json FROM settings WHERE key = ?1", [key], |r| r.get(0)).optional()?;
        raw.map(|s| from_json(&s)).transpose()
    }

    fn set_setting<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value_json) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
            params![key, to_json(value)?],
        )?;
        Ok(())
    }

    pub fn settings(&self) -> Result<AppSettings> {
        Ok(self.setting("app")?.unwrap_or_default())
    }

    pub fn update_settings(&self, settings: &AppSettings) -> Result<AppSettings> {
        if !(0..=300).contains(&settings.autosave_seconds) {
            return Err(StoreError::Invalid("auto-save interval must be 0–300 seconds".into()));
        }
        if !(1..=60).contains(&settings.run_timeout_seconds) {
            return Err(StoreError::Invalid("run time limit must be 1–60 seconds".into()));
        }
        self.set_setting("app", settings)?;
        self.settings()
    }

    // --- drafts ------------------------------------------------------------------

    pub fn draft(&self, problem_id: &str, language: Language) -> Result<Option<Draft>> {
        Ok(self
            .conn
            .query_row(
                "SELECT code, updated_at FROM drafts WHERE problem_id = ?1 AND language = ?2",
                params![problem_id, language.as_str()],
                |r| Ok(Draft { problem_id: problem_id.into(), language, code: r.get(0)?, updated_at: r.get(1)? }),
            )
            .optional()?)
    }

    pub fn save_draft(&self, problem_id: &str, language: Language, code: &str) -> Result<Draft> {
        let updated_at = now();
        self.conn.execute(
            "INSERT INTO drafts (problem_id, language, code, updated_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(problem_id, language) DO UPDATE SET code = excluded.code, updated_at = excluded.updated_at",
            params![problem_id, language.as_str(), code, updated_at],
        )?;
        Ok(Draft { problem_id: problem_id.into(), language, code: code.into(), updated_at })
    }

    // --- data info ---------------------------------------------------------------

    pub fn data_info(&self) -> Result<DataInfo> {
        let count = |sql: &str| -> Result<i64> { Ok(self.conn.query_row(sql, [], |r| r.get(0))?) };
        Ok(DataInfo {
            db_path: self.path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| ":memory:".into()),
            builtin_problems: count("SELECT COUNT(*) FROM problems WHERE origin = 'builtin'")?,
            custom_problems: count("SELECT COUNT(*) FROM problems WHERE origin != 'builtin'")?,
            bank_version: self.setting::<String>("bank_version")?.unwrap_or_default(),
        })
    }

    // --- AI profiles (keys live in the OS keychain, never here) --------------------

    pub fn ai_profiles(&self) -> Result<Vec<AiProfile>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, provider, base_url, model, options_json, has_api_key, is_active
             FROM ai_profiles ORDER BY rowid",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, bool>(6)?,
                r.get::<_, bool>(7)?,
            ))
        })?;
        let mut out = Vec::new();
        for row in rows {
            let (id, name, provider, base_url, model, options, has_api_key, is_active) = row?;
            let opts: serde_json::Value = from_json(&options)?;
            let opt = |k: &str, d: &str| opts.get(k).and_then(|v| v.as_str()).unwrap_or(d).to_string();
            out.push(AiProfile {
                id,
                name,
                provider,
                base_url,
                model,
                effort: opt("effort", "medium"),
                mentor_style: opt("mentorStyle", "socratic"),
                has_api_key,
                is_active,
            });
        }
        Ok(out)
    }

    /// Saves a profile. `has_key` says whether a key is now stored in the keychain for it.
    pub fn save_ai_profile(&self, form: &AiProfileForm, has_key: bool) -> Result<AiProfile> {
        let id = form.id.clone().unwrap_or_else(new_id);
        let options = serde_json::json!({ "effort": form.effort, "mentorStyle": form.mentor_style });
        let first = self.ai_profiles()?.is_empty();
        self.conn.execute(
            "INSERT INTO ai_profiles (id, name, provider, base_url, model, options_json, has_api_key, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, provider = excluded.provider,
               base_url = excluded.base_url, model = excluded.model, options_json = excluded.options_json,
               has_api_key = excluded.has_api_key",
            params![
                id,
                form.name.trim(),
                form.provider,
                form.base_url.trim(),
                form.model.trim(),
                options.to_string(),
                has_key,
                first
            ],
        )?;
        self.ai_profiles()?.into_iter().find(|p| p.id == id).ok_or_else(|| StoreError::NotFound("AI profile".into()))
    }

    pub fn delete_ai_profile(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM ai_profiles WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn set_active_ai_profile(&self, id: &str) -> Result<()> {
        self.conn.execute("UPDATE ai_profiles SET is_active = (id = ?1)", [id])?;
        Ok(())
    }

    // --- mentor chat -------------------------------------------------------------

    pub fn chat(&self, problem_id: &str) -> Result<Vec<ChatMessage>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, role, mode, content, created_at FROM chat_messages
             WHERE problem_id = ?1 ORDER BY created_at, rowid",
        )?;
        let rows = stmt.query_map([problem_id], |r| {
            Ok(ChatMessage {
                id: r.get(0)?,
                problem_id: problem_id.into(),
                role: r.get(1)?,
                mode: r.get(2)?,
                content: r.get(3)?,
                created_at: r.get(4)?,
            })
        })?;
        Ok(rows.collect::<std::result::Result<_, _>>()?)
    }

    pub fn append_chat(&self, problem_id: &str, role: &str, mode: &str, content: &str) -> Result<ChatMessage> {
        let msg = ChatMessage {
            id: new_id(),
            problem_id: problem_id.into(),
            role: role.into(),
            mode: mode.into(),
            content: content.into(),
            created_at: now(),
        };
        self.conn.execute(
            "INSERT INTO chat_messages (id, problem_id, role, mode, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![msg.id, problem_id, role, mode, content, msg.created_at],
        )?;
        Ok(msg)
    }

    pub fn clear_chat(&self, problem_id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM chat_messages WHERE problem_id = ?1", [problem_id])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests;
