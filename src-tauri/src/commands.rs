use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager, State};

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
pub fn set_theme(
    theme: String,
    settings: State<'_, Arc<Settings>>,
    app: AppHandle,
) -> Result<(), String> {
    if !crate::settings::is_valid_theme(&theme) {
        return Err(format!("unknown theme '{theme}'"));
    }
    settings.set_theme(&theme);
    let _ = app.emit("island://settings", settings.view());
    Ok(())
}

#[tauri::command]
pub fn set_compact_size(
    width: i32,
    height: i32,
    settings: State<'_, Arc<Settings>>,
    app: AppHandle,
) {
    settings.set_compact_size(width, height);
    let _ = app.emit("island://settings", settings.view());
}

#[tauri::command]
pub async fn reset_position(
    app: AppHandle,
    settings: State<'_, Arc<Settings>>,
) -> Result<(), String> {
    settings.set_offset(0, 0);
    if let Some(window) = app.get_webview_window("island") {
        crate::window_setup::place(&window, 0.0, 0.0);
    }
    let _ = app.emit("island://settings", settings.view());
    Ok(())
}

// These touch the window manager. Commands without `async` run on the main
// thread, where creating or closing a webview would deadlock the event loop.
#[tauri::command]
pub async fn open_settings(app: AppHandle) -> Result<(), String> {
    crate::settings_window::open(&app)
}

#[tauri::command]
pub async fn close_settings(app: AppHandle) -> Result<(), String> {
    crate::settings_window::close(&app)
}

#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
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
