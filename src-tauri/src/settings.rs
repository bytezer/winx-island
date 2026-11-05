//! User settings: a small YAML file under %APPDATA%\winx-island.
//!
//! The file is the single source of truth for the visualizer switch, the
//! shortcut list and UI Ans state. It is only written when the app changes a
//! value, so hand edits survive restarts.

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use serde::{Deserialize, Serialize};

use crate::logger::logline;
use crate::shortcuts;

pub const PANEL_TAB_MEDIA: &str = "media";
pub const PANEL_TAB_SHORTCUTS: &str = "shortcuts";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct VisualizerSettings {
    pub enabled: bool,
}

impl Default for VisualizerSettings {
    fn default() -> Self {
        Self { enabled: true }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct UiSettings {
    pub last_panel_tab: String,
}

impl Default for UiSettings {
    fn default() -> Self {
        Self {
            last_panel_tab: PANEL_TAB_MEDIA.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutEntry {
    pub id: String,
    pub kind: String,
    pub label: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub path: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SettingsFile {
    pub visualizer: VisualizerSettings,
    pub shortcuts: Vec<ShortcutEntry>,
    pub ui: UiSettings,
}

impl SettingsFile {
    fn defaults() -> Self {
        Self {
            visualizer: VisualizerSettings::default(),
            shortcuts: shortcuts::default_entries(),
            ui: UiSettings::default(),
        }
    }

    fn is_valid_panel_tab(tab: &str) -> bool {
        tab == PANEL_TAB_MEDIA || tab == PANEL_TAB_SHORTCUTS
    }
}

/// View sent to the frontend: paths stay on the native side.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutView {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub icon: String,
    pub missing: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    pub visualizer_enabled: bool,
    pub last_panel_tab: String,
    pub shortcuts: Vec<ShortcutView>,
}

pub struct Settings {
    state: RwLock<SettingsFile>,
    path: PathBuf,
}

/// Comment header written above every save so the file is self-documenting.
const SETTINGS_HEADER: &str = r#"# winx-island settings
#
# Shortcuts are declared here and picked up on the next app start.
# - kind: folder   -> opens itself in Explorer; "path" is required
# - kind: action   -> built-in targets: recycle-bin, settings, suspend
# - icon names: folder, download, documents, pictures, desktop, trash,
#   settings, suspend
# - Windows paths may use %VAR% expansion, for example
#   "%USERPROFILE%\Documents".
# - WSL folders live under \\wsl.localhost\\<distro>\\..., for example
#   \\wsl.localhost\\Ubuntu\\home\\zero\\projects. The distro must be
#   running, otherwise the tile is drawn in red until it is.
# - The grid scrolls, so any number of tiles works.
# - "ui.lastPanelTab" is one of: media, shortcuts.
# - "visualizer.enabled" drives the peak meter bars.

"#;


impl Settings {
    pub fn load() -> Arc<Self> {
        let path = data_dir().join("settings.yaml");
        let candidates: Option<SettingsFile> = match fs::read_to_string(&path) {
            Ok(text) => {
                let parsed = match serde_yaml::from_str::<SettingsFile>(&text) {
                    Ok(value) => Some(value),
                    Err(error) => {
                        logline!("invalid settings file, using defaults: {error}");
                        Some(SettingsFile::default())
                    }
                };
                parsed
            }
            Err(_) => None,
        };

        let file = match candidates {
            Some(file) => {
                logline!(
                    "settings loaded from {} ({} shortcut(s))",
                    path.display(),
                    file.shortcuts.len()
                );
                file
            }
            None => {
                // The file is either absent or unparsable; keep the raw bytes
                // around as a backup when it exists.
                if let Ok(raw) = fs::read_to_string(&path) {
                    let backup = path.with_extension("yaml.broken");
                    let _ = fs::write(&backup, &raw);
                    logline!("invalid settings file kept as {}", backup.display());
                } else {
                    logline!("no settings file, writing defaults");
                }
                Self::write(&path, &SettingsFile::defaults());
                SettingsFile::defaults()
            }
        };

        Arc::new(Self {
            state: RwLock::new(file),
            path,
        })
    }

    pub fn visualizer_enabled(&self) -> bool {
        self.state.read().map(|file| file.visualizer.enabled).unwrap_or(true)
    }

    pub fn entry(&self, id: &str) -> Option<ShortcutEntry> {
        self.state
            .read()
            .ok()?
            .shortcuts
            .iter()
            .find(|entry| entry.id == id)
            .cloned()
    }

    pub fn view(&self) -> SettingsView {
        let file = self
            .state
            .read()
            .map(|file| file.clone())
            .unwrap_or_default();
        SettingsView {
            visualizer_enabled: file.visualizer.enabled,
            last_panel_tab: file.ui.last_panel_tab.clone(),
            shortcuts: file
                .shortcuts
                .iter()
                .map(|entry| ShortcutView {
                    id: entry.id.clone(),
                    kind: entry.kind.clone(),
                    label: entry.label.clone(),
                    icon: entry.icon.clone(),
                    missing: shortcuts::is_missing(entry),
                })
                .collect(),
        }
    }

    /// Makes sure the file exists so the settings location button always has
    /// something to reveal.
    pub fn ensure_file(&self) {
        let snapshot = {
            let Ok(file) = self.state.read() else {
                return;
            };
            file.clone()
        };
        Self::write(&self.path, &snapshot);
    }

    pub fn set_visualizer_enabled(&self, enabled: bool) {
        self.update(|file| file.visualizer.enabled = enabled);
    }

    pub fn set_last_panel_tab(&self, tab: &str) {
        if !SettingsFile::is_valid_panel_tab(tab) {
            return;
        }
        self.update(|file| file.ui.last_panel_tab = tab.to_string());
    }

    fn update<F: FnOnce(&mut SettingsFile)>(&self, mutate: F) {
        let updated = {
            let Ok(mut file) = self.state.write() else {
                return;
            };
            mutate(&mut file);
            file.clone()
        };
        Self::write(&self.path, &updated);
    }

    fn write(path: &PathBuf, file: &SettingsFile) {
        match serde_yaml::to_string(file) {
            Ok(document) => {
                logline!(
                    "writing settings ({} shortcuts, visualizer {}, tab '{}')",
                    file.shortcuts.len(),
                    file.visualizer.enabled,
                    file.ui.last_panel_tab
                );
                if let Some(parent) = path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let text = format!("{SETTINGS_HEADER}{document}");
                // Atomic-ish: a concurrent read can never see a half-written
                // document, which used to parse as two YAML documents.
                let scratch = path.with_extension("yaml.tmp");
                if fs::write(&scratch, &text).is_ok() {
                    match fs::rename(&scratch, path) {
                        Ok(()) => {}
                        Err(_) => {
                            let _ = fs::remove_file(path);
                            if let Err(error) = fs::rename(&scratch, path) {
                                logline!("failed to save settings: {error}");
                            }
                        }
                    }
                } else {
                    logline!("failed to write settings scratch file");
                    if let Err(error) = fs::write(path, text) {
                        logline!("failed to save settings: {error}");
                    }
                }
            }
            Err(error) => logline!("failed to serialize settings: {error}"),
        }
    }
}

pub fn data_dir() -> PathBuf {
    if let Some(value) = std::env::var_os("APPDATA") {
        return PathBuf::from(value).join("winx-island");
    }
    if let Some(value) = std::env::var_os("LOCALAPPDATA") {
        return PathBuf::from(value).join("winx-island");
    }
    std::env::temp_dir().join("winx-island")
}
