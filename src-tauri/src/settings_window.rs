//! The settings window: a second, on-demand webview that hosts the React
//! settings UI.
//!
//! Unlike the island, this is a normal desktop window. It takes keyboard focus,
//! is listed in the taskbar and is never touched by `pointer.rs`,
//! `window_setup::configure` or the click-through flags: those only ever target
//! the `island` window.

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::logger::logline;

/// Window label shared with the frontend capability file.
pub const LABEL: &str = "settings";
/// Logical size of the settings window; the frontend layout assumes it.
pub const WIDTH: f64 = 693.0;
pub const HEIGHT: f64 = 420.0;

/// Shows the settings window, creating it the first time.
pub fn open(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(LABEL) {
        return reveal(&window);
    }

    match create(app) {
        Ok(()) => Ok(()),
        // Two rapid clicks can race the lookup above; if the window exists now,
        // just bring it forward instead of surfacing a creation error.
        Err(error) => match app.get_webview_window(LABEL) {
            Some(window) => reveal(&window),
            None => Err(error),
        },
    }
}

fn reveal(window: &tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    // A minimised window would otherwise stay in the taskbar.
    let _ = window.unminimize();
    window.set_focus().map_err(|error| error.to_string())?;
    logline!("settings window focused");
    Ok(())
}

fn create(app: &AppHandle) -> Result<(), String> {
    logline!("creating settings window");
    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
        // The frontend picks the settings UI from this flag instead of a hash,
        // so a reload keeps working.
        .initialization_script("window.__winxSettingsWindow = true;")
        .title("winx-island settings")
        .inner_size(WIDTH, HEIGHT)
        .center()
        .decorations(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .skip_taskbar(false)
        .always_on_top(false)
        .focusable(true)
        // Shown from the page load handler so the first frame is never blank.
        .visible(false)
        .on_page_load(|window, payload| {
            // `Started` fires before the first paint; showing then would flash
            // the webview's default white background.
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            if let Err(error) = window.show() {
                logline!("failed to show the settings window: {error}");
            }
            if let Err(error) = window.set_focus() {
                logline!("failed to focus the settings window: {error}");
            }
            logline!("settings window shown (page load)");
        })
        .build()
        .map_err(|error| {
            logline!("failed to create the settings window: {error}");
            error.to_string()
        })?;

    logline!("settings window created");
    Ok(())
}

/// Closes the settings window if it exists.
pub fn close(app: &AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(LABEL) else {
        return Ok(());
    };
    window.close().map_err(|error| error.to_string())?;
    logline!("settings window closed");
    Ok(())
}
