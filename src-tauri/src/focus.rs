use std::time::Duration;

use tauri::Manager;
use windows::Win32::Foundation::RECT;
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::Shell::{
    SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, IsZoomed};

use crate::logger::logline;

/// Hides the island while a fullscreen app or game is in the foreground, the
/// same signal Windows itself uses to suppress toasts.
pub fn spawn(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut hidden_for_fullscreen = false;
        loop {
            std::thread::sleep(Duration::from_millis(900));

            let Some(window) = app.get_webview_window("island") else {
                continue;
            };

            let fullscreen = is_fullscreen();
            if fullscreen == hidden_for_fullscreen {
                continue;
            }
            hidden_for_fullscreen = fullscreen;

            if fullscreen {
                let _ = window.hide();
            } else {
                let _ = window.set_ignore_cursor_events(true);
                let _ = window.show();
            }
            logline!("fullscreen={fullscreen} window_hidden={fullscreen}");
        }
    });
}

fn is_fullscreen() -> bool {
    unsafe {
        if let Ok(state) = SHQueryUserNotificationState() {
            if state == QUNS_RUNNING_D3D_FULL_SCREEN
                || state == QUNS_PRESENTATION_MODE
                || state == QUNS_BUSY
            {
                return true;
            }
        }

        let foreground = GetForegroundWindow();
        if foreground.0.is_null() {
            return false;
        }

        // A maximized window with an auto-hidden taskbar matches the monitor
        // rect, so it must not be treated as fullscreen.
        if IsZoomed(foreground).as_bool() {
            return false;
        }

        let mut window_rect = RECT::default();
        if GetWindowRect(foreground, &mut window_rect).is_err() {
            return false;
        }

        let monitor = MonitorFromWindow(foreground, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return false;
        }

        let screen = info.rcMonitor;
        window_rect.left <= screen.left
            && window_rect.top <= screen.top
            && window_rect.right >= screen.right
            && window_rect.bottom >= screen.bottom
    }
}
