use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};

use crate::media::{Command, Controller};
use crate::pointer::{PointerState, Rect};
use crate::settings::Settings;
use crate::shortcuts;

#[derive(serde::Deserialize)]
pub struct RectInput {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[tauri::command]
pub fn set_interactive_rect(rect: RectInput, state: State<'_, Arc<PointerState>>) {
    state.set_rect(Rect {
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
    });
}

#[tauri::command]
pub fn media_control(
    action: String,
    position_ms: Option<i64>,
    controller: State<'_, Controller>,
) -> Result<(), String> {
    match action.as_str() {
        "seek" => controller.send(Command::Seek(position_ms.unwrap_or(0))),
        other => controller.send(Command::Transport(other.to_string())),
    }
}

#[tauri::command]
pub fn get_settings(settings: State<'_, Arc<Settings>>) -> crate::settings::SettingsView {
    settings.view()
}

#[tauri::command]
pub fn set_visualizer_enabled(enabled: bool, settings: State<'_, Arc<Settings>>, app: AppHandle) {
    settings.set_visualizer_enabled(enabled);
    let _ = app.emit("island://settings", settings.view());
}

#[tauri::command]
pub fn set_panel_tab(tab: String, settings: State<'_, Arc<Settings>>, app: AppHandle) {
    settings.set_last_panel_tab(&tab);
    let _ = app.emit("island://settings", settings.view());
}

#[tauri::command]
pub fn begin_drag(
    app: AppHandle,
    state: State<'_, Arc<PointerState>>,
    settings: State<'_, Arc<Settings>>,
) {
    crate::drag::begin(app, state.inner().clone(), settings.inner().clone());
}

#[tauri::command]
pub fn open_settings_location(settings: State<'_, Arc<Settings>>) {
    // Reveal, never edit: the default .yaml editor may not exist on the host.
    settings.ensure_file();
    let path = crate::settings::data_dir().join("settings.yaml");
    if let Err(error) = shortcuts::reveal_in_explorer(&path) {
        crate::logger::log(format!("settings reveal failed: {error}"));
    }
}

#[tauri::command]
pub fn open_shortcut(id: String, settings: State<'_, Arc<Settings>>) {
    let Some(entry) = settings.entry(&id) else {
        crate::logger::log(format!("shortcut '{id}' is not defined"));
        return;
    };

    // Suspending the machine blocks until resume, so never run this on the
    // calling thread. Failures are reported through the log.
    std::thread::spawn(move || {
        if let Err(error) = shortcuts::open(&entry) {
            crate::logger::log(format!("shortcut open failed: {error}"));
        }
    });
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub async fn open_music_files(controller: State<'_, Controller>) -> Result<bool, String> {
    let files = tauri::async_runtime::spawn_blocking(crate::music_picker::select_files)
        .await.map_err(|error| error.to_string())??;
    if files.is_empty() { return Ok(false); }
    controller.send(Command::OpenFiles(files))?;
    Ok(true)
}

#[tauri::command]
pub fn use_system_media(controller: State<'_, Controller>) -> Result<(), String> {
    controller.send(Command::UseSystem)
}

#[tauri::command]
pub fn refresh_media(controller: State<'_, Controller>) -> Result<(), String> {
    controller.send(Command::Refresh)
}

#[tauri::command]
pub async fn add_music_folders(controller: State<'_, Controller>) -> Result<Option<FolderImport>, String> {
    let scan = tauri::async_runtime::spawn_blocking(|| {
        let folders = crate::music_picker::select_folders()?;
        if folders.is_empty() { return Ok::<_, String>(None); }
        Ok(Some(crate::music_library::scan_folders(&folders)))
    }).await.map_err(|error| error.to_string())??;
    let Some(scan) = scan else { return Ok(None); };
    if scan.tracks.is_empty() {
        return Err(if scan.skipped_folders > 0 {
            "No music found. Some folders could not be read; check their location and permissions.".into()
        } else {
            "No supported music files found in the selected folders or their subfolders.".into()
        });
    }
    let result = FolderImport { found: scan.tracks.len(), skipped_folders: scan.skipped_folders };
    controller.send(Command::AddFiles(scan.tracks))?;
    Ok(Some(result))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderImport {
    found: usize,
    skipped_folders: usize,
}

#[tauri::command]
pub fn save_theme(
    theme: crate::theme::ThemeSettings,
    settings: State<'_, Arc<Settings>>,
    app: AppHandle,
) -> Result<crate::theme::ThemeSettings, String> {
    let saved = settings.set_theme(theme)?;
    let _ = app.emit("island://settings", settings.view());
    Ok(saved)
}

#[tauri::command]
pub async fn open_appearance_editor(app: AppHandle) -> Result<(), String> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
    if let Some(window) = app.get_webview_window("appearance") {
        window.show().map_err(|error| error.to_string())?;
        window.unminimize().map_err(|error| error.to_string())?;
        return window.set_focus().map_err(|error| error.to_string());
    }
    WebviewWindowBuilder::new(&app, "appearance", WebviewUrl::App("index.html?view=appearance".into()))
        .title("Personalizar — winx-island")
        .inner_size(900.0, 680.0)
        .min_inner_size(760.0, 580.0)
        .center()
        .focused(true)
        .build().map_err(|error| error.to_string())?;
    Ok(())
}
