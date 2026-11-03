use std::sync::Arc;

use tauri::State;

use crate::media::{Command, Controller};
use crate::pointer::{PointerState, Rect};

#[derive(serde::Deserialize)]
pub struct RectInput {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[tauri::command]
pub fn set_interactive_rect(rect: RectInput, state: State<'_, Arc<PointerState>>) {
    crate::logger::log(format!(
        "interactive rect x={} y={} w={} h={}",
        rect.x, rect.y, rect.w, rect.h
    ));
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
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
