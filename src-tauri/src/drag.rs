//! Right-button drag to reposition the island.
//!
//! The webview cannot be trusted to keep receiving mouse events once the cursor
//! leaves the window, so the drag runs on a dedicated thread: it polls the
//! cursor, moves the window and persists the resulting offset from the
//! top-centre anchor when the button is released.

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_RBUTTON};
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

use crate::logger::logline;
use crate::pointer::PointerState;
use crate::settings::Settings;

pub fn begin(app: AppHandle, state: Arc<PointerState>, settings: Arc<Settings>) {
    if state.dragging.swap(true, Ordering::SeqCst) {
        return;
    }

    let _ = app.emit("island://dragging", true);
    std::thread::spawn(move || {
        if let Err(error) = run(&app, &state, &settings) {
            logline!("drag aborted: {error}");
        }
        state.dragging.store(false, Ordering::SeqCst);
        let _ = app.emit("island://dragging", false);
    });
}

fn run(app: &AppHandle, state: &PointerState, settings: &Arc<Settings>) -> Result<(), String> {
    use crate::positioning::{clamp_origin, nearest_monitor, Bounds, Point};
    let window = app
        .get_webview_window("island")
        .ok_or("island window is gone")?;
    let cursor = cursor_position().ok_or("no cursor position")?;
    let origin = window.outer_position().map_err(|error| error.to_string())?;
    let start_scale = window.scale_factor().map_err(|error| error.to_string())?;
    let original = state.rect();
    let appearance = settings.appearance();
    let compact = Bounds {
        x: (560.0 - appearance.compact_width as f64) / 2.0,
        y: 10.0,
        w: appearance.compact_width as f64,
        h: appearance.compact_height as f64,
    };
    let grab = Point {
        x: compact.x
            + (((cursor.x - origin.x) as f64 / start_scale - original.x) / original.w)
                .clamp(0.0, 1.0)
                * compact.w,
        y: compact.y
            + (((cursor.y - origin.y) as f64 / start_scale - original.y) / original.h)
                .clamp(0.0, 1.0)
                * compact.h,
    };
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let screens: Vec<_> = monitors.iter().map(crate::window_setup::screen).collect();
    let _ = window.set_ignore_cursor_events(false);
    loop {
        if let Some(current) = cursor_position() {
            let scale = window.scale_factor().unwrap_or(start_scale);
            let point = Point {
                x: current.x as f64,
                y: current.y as f64,
            };
            if let Some(index) = nearest_monitor(point, &screens) {
                let wanted = Point {
                    x: point.x - grab.x * scale,
                    y: point.y - grab.y * scale,
                };
                let position = clamp_origin(wanted, compact, scale, screens[index]);
                let _ = window.set_position(PhysicalPosition::new(
                    position.x.round() as i32,
                    position.y.round() as i32,
                ));
            }
        }
        if !right_button_down() {
            break;
        }
        std::thread::sleep(Duration::from_millis(8));
    }
    let _ = window.set_ignore_cursor_events(true);
    store_offset(&window, settings);
    Ok(())
}

fn store_offset(window: &tauri::WebviewWindow, settings: &Arc<Settings>) {
    let Ok(Some(primary)) = window.primary_monitor() else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(scale) = window.scale_factor() else {
        return;
    };
    let (offset_x, offset_y) = crate::positioning::offsets_from_origin(
        crate::positioning::Point {
            x: position.x as f64,
            y: position.y as f64,
        },
        scale,
        crate::window_setup::screen(&primary),
    );
    settings.set_offset(offset_x, offset_y);
    logline!("island moved to offsetX={offset_x} offsetY={offset_y}");
}

fn cursor_position() -> Option<POINT> {
    let mut point = POINT::default();
    unsafe { GetCursorPos(&mut point) }.ok().map(|_| point)
}

fn right_button_down() -> bool {
    let state = unsafe { GetAsyncKeyState(VK_RBUTTON.0 as i32) };
    (state as u16 & 0x8000) != 0
}
