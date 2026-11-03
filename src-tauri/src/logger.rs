use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

/// The binary is a GUI subsystem executable, so stdout is not visible. Every
/// diagnostic goes to %TEMP%\winx-island.log instead.
pub fn init() {
    let path = std::env::temp_dir().join("winx-island.log");
    let _ = std::fs::remove_file(&path);
    let _ = LOG_PATH.set(path);
    log("session started");
}

pub fn log(message: impl AsRef<str>) {
    let Some(path) = LOG_PATH.get() else {
        return;
    };
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[{stamp}] {}", message.as_ref());
    }
}

macro_rules! logline {
    ($($arg:tt)*) => {
        $crate::logger::log(format!($($arg)*))
    };
}

pub(crate) use logline;
