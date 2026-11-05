use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

use crate::logger::logline;

#[derive(Clone, Copy, Debug)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Default for Rect {
    fn default() -> Self {
        // Matches the compact pill reported by the frontend on first render.
        Self {
            x: (560.0 - 132.0) / 2.0,
            y: 10.0,
            w: 132.0,
            h: 40.0,
        }
    }
}

pub struct PointerState {
    pub rect: Mutex<Rect>,
    /// Set while a right-button drag is in progress: click-through stays off.
    pub dragging: AtomicBool,
}

impl Default for PointerState {
    fn default() -> Self {
        Self {
            rect: Mutex::new(Rect::default()),
            dragging: AtomicBool::new(false),
        }
    }
}

impl PointerState {
    pub fn set_rect(&self, rect: Rect) {
        if let Ok(mut current) = self.rect.lock() {
            *current = rect;
        }
    }

    fn rect(&self) -> Rect {
        self.rect.lock().map(|value| *value).unwrap_or_default()
    }
}

#[derive(Clone, Copy, Serialize)]
struct PointerPayload {
    inside: bool,
}

/// Polls the OS cursor and toggles click-through on the window. The webview
/// cannot be used for hover detection: outside the pill the window ignores the
/// mouse entirely, so the state has to be computed on the native side.
pub fn spawn(app: AppHandle, state: Arc<PointerState>) {
    std::thread::spawn(move || {
        let mut last: Option<bool> = None;
        let mut geometry: Option<(f64, f64, f64)> = None;
        let mut tick: u32 = 0;

        loop {
            std::thread::sleep(Duration::from_millis(16));
            tick = tick.wrapping_add(1);

            let Some(window) = app.get_webview_window("island") else {
                continue;
            };

            // A drag owns the pointer and the window position; emitting
            // hover changes mid-gesture would collapse the island.
            if state.dragging.load(Ordering::Relaxed) {
                last = None;
                continue;
            }

            // Querying the runtime for the window rect every frame is wasteful;
            // the window only moves on startup or a display change.
            if geometry.is_none() || tick % 32 == 0 {
                if let (Ok(origin), Ok(scale)) = (window.outer_position(), window.scale_factor()) {
                    geometry = Some((origin.x as f64, origin.y as f64, scale));
                }
            }

            let visible = window.is_visible().unwrap_or(false);
            let hit = match (visible, geometry) {
                (true, Some((x, y, scale))) => hit_test(&state, x, y, scale),
                _ => Hit::default(),
            };

            if last == Some(hit.inside) {
                continue;
            }
            last = Some(hit.inside);

            let _ = window.set_ignore_cursor_events(!hit.inside);
            if let Some(hwnd) = crate::window_setup::hwnd_of(&window) {
                crate::window_setup::reapply_click_through_styles(hwnd);
            }
            let _ = app.emit("island://pointer", PointerPayload { inside: hit.inside });
            logline!(
                "pointer inside={} cursor=({},{}) bounds=({:.0},{:.0})-({:.0},{:.0})",
                hit.inside,
                hit.cursor_x,
                hit.cursor_y,
                hit.left,
                hit.top,
                hit.right,
                hit.bottom
            );
        }
    });
}

#[derive(Default)]
struct Hit {
    inside: bool,
    cursor_x: i32,
    cursor_y: i32,
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
}

fn hit_test(state: &PointerState, origin_x: f64, origin_y: f64, scale: f64) -> Hit {
    let rect = state.rect();

    let mut cursor = POINT::default();
    if unsafe { GetCursorPos(&mut cursor) }.is_err() {
        return Hit::default();
    }

    // A few pixels of slack make the pill easier to catch with the cursor.
    let slack = 4.0;
    let left = origin_x + (rect.x - slack) * scale;
    let top = origin_y + (rect.y - slack) * scale;
    let right = left + (rect.w + slack * 2.0) * scale;
    let bottom = top + (rect.h + slack * 2.0) * scale;

    let x = cursor.x as f64;
    let y = cursor.y as f64;
    Hit {
        inside: x >= left && x <= right && y >= top && y <= bottom,
        cursor_x: cursor.x,
        cursor_y: cursor.y,
        left,
        top,
        right,
        bottom,
    }
}
