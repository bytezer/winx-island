#![windows_subsystem = "windows"]

mod audio;
mod commands;
mod focus;
mod logger;
mod media;
mod pointer;
mod settings;
mod shortcuts;
mod window_setup;

use std::sync::Arc;
use std::time::Duration;

use tauri::{WebviewUrl, WebviewWindowBuilder};

use logger::logline;

fn main() {
    logger::init();
    std::panic::set_hook(Box::new(|info| logger::log(format!("panic: {info}"))));

    let pointer_state = Arc::new(pointer::PointerState::default());
    let (media_controller, media_receiver) = media::channel();
    let app_settings = settings::Settings::load();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {
            logline!("another instance was launched, keeping the running island");
        }))
        .manage(pointer_state.clone())
        .manage(media_controller)
        .manage(app_settings.clone())
        .invoke_handler(tauri::generate_handler![
            commands::set_interactive_rect,
            commands::media_control,
            commands::get_settings,
            commands::set_visualizer_enabled,
            commands::set_panel_tab,
            commands::open_shortcut,
            commands::quit_app,
        ])
        .setup(move |app| {
            logline!("creating island window");

            let start_view = std::env::var("WINX_START_VIEW").unwrap_or_default();
            let start_tab = std::env::var("WINX_START_TAB").unwrap_or_default();
            let init_script = format!(
                "window.__winxStartView = {}; window.__winxStartTab = {};",
                serde_json::to_string(&start_view).unwrap_or_else(|_| "\"\"".to_string()),
                serde_json::to_string(&start_tab).unwrap_or_else(|_| "\"\"".to_string())
            );

            let window = WebviewWindowBuilder::new(app, "island", WebviewUrl::App("index.html".into()))
                .initialization_script(&init_script)
                .title("winx-island")
                .inner_size(window_setup::CANVAS_WIDTH, window_setup::CANVAS_HEIGHT)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .shadow(false)
                .focusable(false)
                .visible(false)
                .on_page_load(|window, _payload| {
                    let _ = window.set_ignore_cursor_events(true);
                    let _ = window.show();
                    // Tao applies the taskbar flags while showing the window, so
                    // the tool-window style is restored right afterwards.
                    if let Some(hwnd) = window_setup::hwnd_of(&window) {
                        window_setup::reapply_click_through_styles(hwnd);
                    }
                    logline!("island window shown (page load)");
                })
                .build()?;

            window_setup::configure(&window);
            window_setup::place(&window);

            // Safety net in case the page load handler never fires.
            let reveal = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(2500));
                if !reveal.is_visible().unwrap_or(false) {
                    let _ = reveal.set_ignore_cursor_events(true);
                    let _ = reveal.show();
                    logline!("island window shown (fallback)");
                }
            });

            let app_handle = app.handle().clone();
            media::spawn(app_handle.clone(), media_receiver);
            audio::spawn(app_handle.clone(), app_settings.clone());
            focus::spawn(app_handle);
            pointer::spawn(app.handle().clone(), pointer_state.clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run winx-island");
}
