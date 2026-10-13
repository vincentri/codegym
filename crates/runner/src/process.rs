//! Running child processes with a time limit and capped output.

use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, ExitStatus, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use wait_timeout::ChildExt;

/// A detected command-line tool, such as `node` or `go`.
#[derive(Debug, Clone)]
pub struct Tool {
    pub path: PathBuf,
    pub version: String,
}

impl Tool {
    /// Finds the first of `names` that answers `version_args`, on PATH or in the usual install
    /// folders (apps started from a desktop launcher often get a minimal PATH).
    pub fn detect(names: &[&str], version_args: &[&str]) -> Option<Tool> {
        let search = search_path();
        let cwd = std::env::current_dir().unwrap_or_default();
        names.iter().find_map(|name| {
            let path = which::which_in(name, Some(&search), &cwd).ok()?;
            let out = Command::new(&path).args(version_args).stdin(Stdio::null()).output().ok()?;
            if !out.status.success() {
                return None;
            }
            let text = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
            Some(Tool { path, version: parse_version(&text) })
        })
    }

    pub fn command(&self) -> Command {
        Command::new(&self.path)
    }
}

/// PATH plus the folders where installers put Node.js, Python and Go.
fn search_path() -> std::ffi::OsString {
    let mut dirs: Vec<PathBuf> =
        std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from);
    if cfg!(windows) {
        for var in ["ProgramFiles", "LOCALAPPDATA"] {
            if let Some(base) = std::env::var_os(var).map(PathBuf::from) {
                dirs.extend([base.join("Go").join("bin"), base.join("nodejs"), base.join("Programs").join("Python")]);
            }
        }
    } else {
        dirs.extend(["/usr/local/go/bin", "/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin"].map(PathBuf::from));
        if let Some(home) = &home {
            dirs.extend([
                home.join("go/bin"),
                home.join(".volta/bin"),
                home.join(".local/bin"),
                home.join(".asdf/shims"),
            ]);
        }
    }
    std::env::join_paths(dirs).unwrap_or_default()
}

/// Pulls `22.1.0` out of `v22.1.0`, `Python 3.12.3` or `go version go1.24.7 linux/amd64`.
fn parse_version(text: &str) -> String {
    text.split_whitespace()
        .map(|w| w.trim_start_matches("go").trim_start_matches('v'))
        .find(|w| w.chars().next().is_some_and(|c| c.is_ascii_digit()) && w.contains('.'))
        .unwrap_or(text.trim())
        .to_string()
}

#[derive(Debug, Default)]
pub struct Output {
    pub stdout: String,
    pub stderr: String,
    pub status: Option<ExitStatus>,
    pub timed_out: bool,
    /// The program printed more than the cap, so it was stopped.
    pub output_limited: bool,
    pub elapsed: Duration,
}

impl Output {
    pub fn success(&self) -> bool {
        self.status.is_some_and(|s| s.success())
    }
}

pub const OUTPUT_CAP: usize = 8 * 1024 * 1024;

fn drain(mut source: impl Read + Send + 'static, cap: usize, over: Arc<AtomicBool>) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut kept = Vec::new();
        let mut buf = [0u8; 16 * 1024];
        loop {
            match source.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let room = cap.saturating_sub(kept.len());
                    kept.extend_from_slice(&buf[..n.min(room)]);
                    if n > room {
                        over.store(true, Ordering::Relaxed);
                    }
                }
            }
        }
        kept
    })
}

/// Runs `cmd`, feeding it `stdin`, and kills it after `timeout` or once it prints more than
/// [`OUTPUT_CAP`] bytes.
pub fn run(mut cmd: Command, stdin: &[u8], timeout: Duration) -> std::io::Result<Output> {
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let start = Instant::now();
    let mut child = cmd.spawn()?;
    let mut input = child.stdin.take();
    let data = stdin.to_vec();
    let writer = thread::spawn(move || {
        if let Some(pipe) = input.as_mut() {
            let _ = pipe.write_all(&data);
        }
        drop(input);
    });
    let over = Arc::new(AtomicBool::new(false));
    let out = drain(child.stdout.take().expect("piped stdout"), OUTPUT_CAP, over.clone());
    let err = drain(child.stderr.take().expect("piped stderr"), 256 * 1024, Arc::new(AtomicBool::new(false)));

    let mut result = Output::default();
    loop {
        let left = timeout.saturating_sub(start.elapsed());
        if left.is_zero() {
            result.timed_out = true;
            break;
        }
        if over.load(Ordering::Relaxed) {
            result.output_limited = true;
            break;
        }
        if let Some(status) = child.wait_timeout(left.min(Duration::from_millis(25)))? {
            result.status = Some(status);
            break;
        }
    }
    if result.status.is_none() {
        let _ = child.kill();
        let _ = child.wait();
    }
    result.elapsed = start.elapsed();
    let _ = writer.join();
    result.stdout = String::from_utf8_lossy(&out.join().unwrap_or_default()).into_owned();
    result.stderr = String::from_utf8_lossy(&err.join().unwrap_or_default()).into_owned();
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::{Tool, parse_version};

    /// Run with a stripped PATH (as a desktop launcher gives) to exercise the fallback folders.
    #[test]
    fn finds_tools_in_install_folders() {
        let path = std::env::var("PATH").unwrap_or_default();
        if std::path::Path::new("/usr/local/go/bin/go").exists() && !path.contains("/usr/local/go/bin") {
            assert!(Tool::detect(&["go"], &["version"]).is_some());
        }
    }

    #[test]
    fn parses_versions() {
        assert_eq!(parse_version("v22.22.0\n"), "22.22.0");
        assert_eq!(parse_version("Python 3.13.16"), "3.13.16");
        assert_eq!(parse_version("go version go1.24.7 linux/amd64"), "1.24.7");
    }
}
