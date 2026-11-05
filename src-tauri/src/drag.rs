//! Right-button drag to reposition the island.
//!
//! The webview cannot be trusted to keep receiving mouse events once the cursor
//! leaves the window, so the drag runs on a dedicated thread: it polls the
//! cursor, moves the window and persists the resulting offset from the
//! top-centre anchor when the button is released.

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Manager, PhysicalPosition};
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_RBUTTON};
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

use crate::logger::logline;
use crate::pointer::PointerState;
use crate::settings::Settings;
use crate::window_setup::CANVAS_WIDTH;

pub fn begin(app: AppHandle, state: Arc<PointerState>, settings: Arc<Settings>) {
    // One drag at a time; a second right click while dragging is ignored.
    if state.dragging.swap(true, Ordering::SeqCst) {
        return;
    }

    std::thread::spawn(move || {
        if let Err(error) = run(&app, &settings) {
            logline!("drag aborted: {error}");
        }
        state.dragging.store(false, Ordering::SeqCst);
    });
}

fn run(app: &AppHandle, settings: &Arc<Settings>) -> Result<(), String> {
    let window = app
        .get_webview_window("island")
        .ok_or_else(|| "island window is gone".to_string())?;

    let cursor = cursor_position().ok_or_else(|| "no cursor position".to_string())?;
    let origin = window
        .outer_position()
        .map_err(|error| error.to_string())?;

    // Same anchor and bounds the persisted offset uses, so the window cannot
    // be dragged somewhere that would be clamped back on restart.
    let monitor = window
        .primary_monitor()
        .ok()
        .flatten()
        .ok_or_else(|| "no primary monitor".to_string())?;
    let scale = monitor.scale_factor();
    let base_x = monitor.position().x as f64
        + (monitor.size().width as f64 - CANVAS_WIDTH * scale) / 2.0;
    let base_y = monitor.position().y as f64;
    let min_x = base_x - 200.0 * scale;
    let max_x = base_x + 200.0 * scale;
    let min_y = base_y - 10.0 * scale;
    let max_y = base_y + 200.0 * scale;

    // The poller stops toggling click-through while dragging, so force the
    // window interactive for the duration of the gesture.
    let _ = window.set_ignore_cursor_events(false);

    loop {
        std::thread::sleep(Duration::from_millis(16));
        if !right_button_down() {
            break;
        }
        if let Some(current) = cursor_position() {
            let x = (origin.x + (current.x - cursor.x)) as f64;
            let y = (origin.y + (current.y - cursor.y)) as f64;
            let _ = window.set_position(PhysicalPosition::new(
                x.clamp(min_x, max_x).round() as i32,
                y.clamp(min_y, max_y).round() as i32,
            ));
        }
    }

    let _ = window.set_ignore_cursor_events(true);
    store_offset(&window, settings);
    Ok(())
}

fn store_offset(window: &tauri::WebviewWindow, settings: &Arc<Settings>) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };

    let scale = monitor.scale_factor();
    let base_x = monitor.position().x as f64
        + (monitor.size().width as f64 - CANVAS_WIDTH * scale) / 2.0;
    let base_y = monitor.position().y as f64;

    let offset_x = ((position.x as f64 - base_x) / scale).round() as i32;
    let offset_y = ((position.y as f64 - base_y) / scale).round() as i32;
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
