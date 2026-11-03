use std::ffi::c_void;
use std::time::Duration;

use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use tauri::{LogicalSize, PhysicalPosition, WebviewWindow};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_EXCLUDED_FROM_PEEK, DWMWA_TRANSITIONS_FORCEDISABLED,
    DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND, DWM_WINDOW_CORNER_PREFERENCE,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, IsWindow, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    WS_EX_TRANSPARENT,
};

use crate::logger::logline;

pub const CANVAS_WIDTH: f64 = 560.0;
pub const CANVAS_HEIGHT: f64 = 380.0;

/// Physical pixel top margin of the canvas, so the pill does not hug the edge.
const TOP_MARGIN: f64 = 0.0;

pub fn hwnd_of(window: &WebviewWindow) -> Option<HWND> {
    let handle = window.window_handle().ok()?;
    match handle.as_raw() {
        RawWindowHandle::Win32(handle) => Some(HWND(handle.hwnd.get() as *mut c_void)),
        _ => None,
    }
}

/// Turns the window into a tool window that never takes focus, and starts
/// click-through. Rounding, transitions and peek entries are handled by DWM.
pub fn configure(window: &WebviewWindow) {
    let Some(hwnd) = hwnd_of(window) else {
        logline!("unable to resolve the native window handle");
        return;
    };

    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let style = (style
            | WS_EX_TOOLWINDOW.0 as isize
            | WS_EX_NOACTIVATE.0 as isize
            | WS_EX_TRANSPARENT.0 as isize)
            & !(WS_EX_APPWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);

        let corner = DWMWCP_DONOTROUND;
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &corner as *const _ as *const c_void,
            std::mem::size_of::<DWM_WINDOW_CORNER_PREFERENCE>() as u32,
        );

        // DWM boolean attributes are plain 4 byte ints on the ABI.
        let enabled: i32 = 1;
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_TRANSITIONS_FORCEDISABLED,
            &enabled as *const _ as *const c_void,
            std::mem::size_of::<i32>() as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_EXCLUDED_FROM_PEEK,
            &enabled as *const _ as *const c_void,
            std::mem::size_of::<i32>() as u32,
        );

        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }

    keep_on_top(hwnd.0 as isize);
}

/// Tauri rewrites the extended style when click-through is toggled, so the
/// no-activate and tool-window bits are restored right after every change.
pub fn reapply_click_through_styles(hwnd: HWND) {
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        // APPWINDOW would force the window into the taskbar, so it is cleared.
        let wanted = (style | WS_EX_TOOLWINDOW.0 as isize | WS_EX_NOACTIVATE.0 as isize)
            & !(WS_EX_APPWINDOW.0 as isize);
        if wanted != style {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, wanted);
        }
    }
}

/// Places the canvas horizontally centred on the primary monitor.
pub fn place(window: &WebviewWindow) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        logline!("no primary monitor available");
        return;
    };

    let scale = monitor.scale_factor();
    let size = monitor.size();
    let position = monitor.position();
    let width = (CANVAS_WIDTH * scale).round() as i32;
    let x = position.x + (size.width as i32 - width) / 2;
    let y = position.y + (TOP_MARGIN * scale).round() as i32;

    let _ = window.set_size(LogicalSize::new(CANVAS_WIDTH, CANVAS_HEIGHT));
    let _ = window.set_position(PhysicalPosition::new(x, y));
    logline!(
        "placed at x={x} y={y} canvas={}x{} scale={scale}",
        CANVAS_WIDTH,
        CANVAS_HEIGHT
    );
}

/// Some shell surfaces and other topmost windows can steal the band, so the
/// island re-asserts itself every couple of seconds.
fn keep_on_top(hwnd: isize) {
    std::thread::spawn(move || {
        let handle = HWND(hwnd as *mut c_void);
        loop {
            std::thread::sleep(Duration::from_millis(2000));
            unsafe {
                if !IsWindow(Some(handle)).as_bool() {
                    return;
                }
                reapply_click_through_styles(handle);
                let _ = SetWindowPos(
                    handle,
                    Some(HWND_TOPMOST),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }
        }
    });
}
