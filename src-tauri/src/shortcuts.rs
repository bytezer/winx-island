//! Shortcut resolution and execution.
//!
//! Shortcuts are declared in settings.yaml; folders open the Explorer and
//! built-in actions are mapped to native targets.

use std::path::Path;

use windows::core::w;
use windows::Win32::Foundation::HINSTANCE;
use windows::Win32::System::Power::SetSuspendState;
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{SW_SHOWNORMAL};

use crate::logger::logline;
use crate::settings::ShortcutEntry;

pub const RECYCLE_BIN_TARGET: &str = "shell:::{645FF040-5081-101B-9F08-00AA002F954E}";
pub const SETTINGS_TARGET: &str = "ms-settings:";

pub fn default_entries() -> Vec<ShortcutEntry> {
    vec![
        ShortcutEntry {
            id: "downloads".to_string(),
            kind: "folder".to_string(),
            label: "Downloads".to_string(),
            icon: "download".to_string(),
            path: "%USERPROFILE%\\Downloads".to_string(),
        },
        ShortcutEntry {
            id: "documents".to_string(),
            kind: "folder".to_string(),
            label: "Documents".to_string(),
            icon: "documents".to_string(),
            path: "%USERPROFILE%\\Documents".to_string(),
        },
        ShortcutEntry {
            id: "pictures".to_string(),
            kind: "folder".to_string(),
            label: "Pictures".to_string(),
            icon: "pictures".to_string(),
            path: "%USERPROFILE%\\Pictures".to_string(),
        },
        ShortcutEntry {
            id: "desktop".to_string(),
            kind: "folder".to_string(),
            label: "Desktop".to_string(),
            icon: "desktop".to_string(),
            path: "%USERPROFILE%\\Desktop".to_string(),
        },
        ShortcutEntry {
            id: "recycle-bin".to_string(),
            kind: "action".to_string(),
            label: "Recycle Bin".to_string(),
            icon: "trash".to_string(),
            path: RECYCLE_BIN_TARGET.to_string(),
        },
        ShortcutEntry {
            id: "settings".to_string(),
            kind: "action".to_string(),
            label: "Settings".to_string(),
            icon: "settings".to_string(),
            path: SETTINGS_TARGET.to_string(),
        },
        ShortcutEntry {
            id: "suspend".to_string(),
            kind: "action".to_string(),
            label: "Suspend".to_string(),
            icon: "suspend".to_string(),
            path: String::new(),
        },
    ]
}

/// Expands %VAR% pairs against the process environment. Unknown variables are
/// left in place, which also marks the shortcut as missing downstream.
pub fn expand_environment(value: &str) -> String {
    let mut expanded = String::with_capacity(value.len());
    let mut rest = value;

    while let Some(start) = rest.find('%') {
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => {
                let variable = &after[..end];
                let resolved = std::env::var(variable).unwrap_or_default();
                if resolved.is_empty() {
                    logline!("unresolved environment variable in path: {variable}");
                }
                expanded.push_str(&rest[..start]);
                expanded.push_str(&resolved);
                rest = &after[end + 1..];
            }
            None => break,
        }
    }

    expanded.push_str(rest);
    expanded
}

/// A folder shortcut points at a real location; actions are always runnable.
pub fn is_missing(entry: &ShortcutEntry) -> bool {
    if entry.kind != "folder" {
        return false;
    }
    resolve_path(&entry.path)
        .map(|path| !Path::new(&path).exists())
        .unwrap_or(true)
}

pub fn resolve_path(path: &str) -> Option<String> {
    if path.trim().is_empty() {
        return None;
    }
    Some(expand_environment(path))
}

/// Opens the shortcut target. Runs on a worker thread: suspending the machine
/// is blocking by design.
pub fn open(entry: &ShortcutEntry) -> Result<(), String> {
    if entry.kind == "action" && entry.id == "suspend" {
        let ok = unsafe { SetSuspendState(false, false, false) };
        return if ok {
            Ok(())
        } else {
            Err("SetSuspendState returned false".to_string())
        };
    }

    let target = resolve_path(&entry.path).ok_or_else(|| "shortcut has no target".to_string())?;
    match shell_open(&target) {
        Ok(()) => Ok(()),
        Err(error) => {
            logline!("shortcut '{}' failed: {error}", entry.id);
            Err(error)
        }
    }
}

fn shell_open(target: &str) -> Result<(), String> {
    use windows::core::HSTRING;

    let file = HSTRING::from(target);
    let empty = HSTRING::new();
    let instance: HINSTANCE = unsafe {
        ShellExecuteW(None, w!("open"), &file, &empty, &empty, SW_SHOWNORMAL)
    };

    // ShellExecuteW returns an HINSTANCE greater than 32 on success.
    if instance.0 as usize > 32 {
        Ok(())
    } else {
        Err(format!("ShellExecuteW failed for {target}"))
    }
}
