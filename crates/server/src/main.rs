//! `codegym-server`: CodeGym in the browser. Configured with environment variables:
//!
//! | Variable | Default | Meaning |
//! |---|---|---|
//! | `CODEGYM_ADDR` | `127.0.0.1:8080` | Address to listen on |
//! | `CODEGYM_DATA_DIR` | `./data` | Database, API keys and caches |
//! | `CODEGYM_UI_DIR` | `apps/desktop/dist` | The built UI |
//! | `CODEGYM_PYTHON_DIR` | none | WebAssembly Python; without it, the system `python3` runs Python |
//! | `CODEGYM_ALLOWED_HOSTS` | none | Comma-separated host names to answer besides localhost |

use std::path::PathBuf;
use std::sync::Arc;

use codegym_ai::FileStore;
use codegym_runner::RunnerConfig;
use codegym_server::{AppState, app};
use codegym_service::Service;

fn env_path(name: &str) -> Option<PathBuf> {
    std::env::var_os(name).filter(|v| !v.is_empty()).map(PathBuf::from)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = std::env::var("CODEGYM_ADDR").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let data = env_path("CODEGYM_DATA_DIR").unwrap_or_else(|| PathBuf::from("data"));
    let ui = env_path("CODEGYM_UI_DIR").unwrap_or_else(|| PathBuf::from("apps/desktop/dist"));
    let python = env_path("CODEGYM_PYTHON_DIR").filter(|dir| dir.join("python.wasm").is_file());
    let allowed_hosts = std::env::var("CODEGYM_ALLOWED_HOSTS")
        .unwrap_or_default()
        .split(',')
        .map(|h| h.trim().to_string())
        .filter(|h| !h.is_empty())
        .collect();

    std::fs::create_dir_all(&data)?;
    let config =
        RunnerConfig { python_dir: python, cache_dir: Some(data.join("cache/wasmtime")), force_quickjs: false };
    let service =
        Arc::new(Service::open(&data.join("codegym.db"), config, Arc::new(FileStore::new(data.join("secrets.json"))))?);
    let warm = service.clone();
    std::thread::spawn(move || warm.warm_up());

    if !ui.join("index.html").is_file() {
        eprintln!("warning: no UI in {} (set CODEGYM_UI_DIR); only /api is served", ui.display());
    }
    let router = app(AppState::new(service, allowed_hosts), Some(ui));
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("CodeGym is running at http://{}", listener.local_addr()?);
    axum::serve(listener, router).with_graceful_shutdown(shutdown()).await?;
    Ok(())
}

/// Ctrl-C, or SIGTERM from `docker compose down`.
async fn shutdown() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        if let Ok(mut term) = signal(SignalKind::terminate()) {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {}
                _ = term.recv() => {}
            }
            return;
        }
    }
    let _ = tokio::signal::ctrl_c().await;
}
