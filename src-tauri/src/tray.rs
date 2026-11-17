//! The system tray: the island's permanent entry point.
//!
//! The overlay window skips the taskbar, so without a tray there is no way
//! back once the island is hidden, and no way out except a button inside the
//! panel. The menu is drawn by the OS rather than a webview, so its labels
//! are resolved through `crate::catalog` in the active locale.

use std::sync::Arc;

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::logger::logline;
use crate::window_setup;

/// Tray id used to find the icon again when the menu is rebuilt.
const TRAY_ID: &str = "main";

/// Menu ids shared by the builder and the event handler so the two paths
/// cannot drift apart.
const MENU_TOGGLE: &str = "tray-toggle";
const MENU_PLAY_PAUSE: &str = "tray-play-pause";
const MENU_SETTINGS: &str = "tray-settings";
const MENU_QUIT: &str = "tray-quit";

/// Creates the tray icon. The caller logs a failure instead of aborting: a
/// dead tray must not kill the overlay.
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    let icon = tray_icon(app)?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("winx-island")
        // Windows opens the menu on left click by default; that click is
        // reserved for the island toggle, the menu stays on right click.
        .show_menu_on_left_click(false)
        .menu(&menu)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_island(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()))
        .build(app)?;

    logline!("tray created");
    Ok(())
}

/// Rebuilds the menu so the labels follow the current locale and island
/// visibility. Called after every toggle and after a language change; a tray
/// that is gone is only reported, never recreated.
pub fn rebuild(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        logline!("tray rebuild skipped: tray icon is gone");
        return;
    };
    if let Err(error) = build_menu(app).and_then(|menu| tray.set_menu(Some(menu))) {
        logline!("tray menu rebuild failed: {error}");
    }
}

/// Builds the tray menu with labels in the active locale.
///
/// Shared by `init` and `rebuild` so the two paths cannot drift.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let settings = app.state::<Arc<crate::settings::Settings>>();
    let locale = crate::i18n::active(settings.inner());

    let toggle_label = if island_is_visible(app) {
        crate::catalog::text(locale, "tray.hide_island")
    } else {
        crate::catalog::text(locale, "tray.show_island")
    };

    let menu = Menu::new(app)?;
    menu.append(&text_item(app, MENU_TOGGLE, toggle_label)?)?;
    menu.append(&text_item(
        app,
        MENU_PLAY_PAUSE,
        crate::catalog::text(locale, "tray.play_pause"),
    )?)?;
    menu.append(&text_item(
        app,
        MENU_SETTINGS,
        crate::catalog::text(locale, "tray.settings"),
    )?)?;
    menu.append(&text_item(
        app,
        MENU_QUIT,
        crate::catalog::text(locale, "tray.quit"),
    )?)?;
    Ok(menu)
}

/// A plain enabled menu entry without an accelerator.
fn text_item(app: &AppHandle, id: &str, label: String) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, id, label, true, None::<&str>)
}

/// Dispatches a menu activation. Menu events arrive on the main thread, like
/// synchronous commands.
fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        MENU_TOGGLE => toggle_island(app),
        MENU_PLAY_PAUSE => send_play_pause(app),
        MENU_SETTINGS => open_settings(app),
        MENU_QUIT => app.exit(0),
        other => logline!("unknown tray menu item '{other}'"),
    }
}

/// Flips the island visibility.
///
/// `focus.rs` hides the island during fullscreen apps without telling the
/// tray, so the CURRENT visibility is read at click time and the opposite is
/// done; the menu label is best-effort and catches up through `rebuild`
/// after every change.
fn toggle_island(app: &AppHandle) {
    let Some(window) = app.get_webview_window("island") else {
        logline!("island toggle skipped: window is gone");
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.show();
        // Tao applies the taskbar flags while showing the window, so the
        // tool-window style is restored right afterwards, exactly like the
        // island's on_page_load does.
        if let Some(hwnd) = window_setup::hwnd_of(&window) {
            window_setup::reapply_click_through_styles(hwnd);
        }
    }

    rebuild(app);
}

/// Current island visibility, or `false` when unknown.
fn island_is_visible(app: &AppHandle) -> bool {
    app.get_webview_window("island")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

/// Sends the transport toggle to the media thread.
fn send_play_pause(app: &AppHandle) {
    let controller = app.state::<crate::media::Controller>();
    let command = crate::media::Command::Transport("play_pause".into());
    if let Err(error) = controller.send(command) {
        logline!("tray play/pause failed: {error}");
    }
}

/// Opens the settings window.
///
/// Menu handlers run on the main thread, where building a webview would
/// deadlock the event loop (the same shape as a synchronous command), so the
/// call is moved off the thread like the async command does.
fn open_settings(app: &AppHandle) {
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = crate::settings_window::open(&handle) {
            logline!("failed to open the settings window from the tray: {error}");
        }
    });
}

/// Resolves the tray icon, logging which source was used.
///
/// The embedded window icon is the primary source. The fallback reads the
/// icon resource `tauri-build` baked into the executable, which needs no
/// extra cargo feature; `Image::from_bytes` would require enabling
/// `image-png` and pulling the `image` crate into the binary.
fn tray_icon(app: &AppHandle) -> tauri::Result<Image<'_>> {
    if let Some(icon) = app.default_window_icon() {
        logline!("tray icon: using the default window icon");
        return Ok(icon.clone());
    }

    logline!("tray icon: default window icon missing, falling back to the app icon resource");
    Image::from_app_icon_resource(32)
}
