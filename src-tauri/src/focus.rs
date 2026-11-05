use std::time::Duration;

use tauri::Manager;
use windows::Win32::Foundation::RECT;
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::Shell::{
    SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetWindowRect, IsZoomed,
};

use crate::logger::logline;

/// Hides the island while a fullscreen app or game is in the foreground, the
/// same signal Windows itself uses to suppress toasts.
pub fn spawn(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut hidden_for_fullscreen = false;
        let mut streak = 0_u32;
        loop {
            std::thread::sleep(Duration::from_millis(900));

            let Some(window) = app.get_webview_window("island") else {
                continue;
            };

            // A single sample can be a transient shell state, so hiding needs
            // two consecutive fullscreen readings. Showing up again is instant.
            if is_fullscreen() {
                streak = streak.saturating_add(1);
            } else {
                streak = 0;
            }
            let fullscreen = streak >= 2;

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
            logline!(
                "fullscreen={fullscreen} window_hidden={fullscreen} notification_state={} foreground={}",
                notification_state(),
                foreground_class()
            );
        }
    });
}

fn notification_state() -> i32 {
    unsafe {
        SHQueryUserNotificationState()
            .map(|state| state.0)
            .unwrap_or(-1)
    }
}

fn foreground_class() -> String {
    unsafe {
        let foreground = GetForegroundWindow();
        if foreground.0.is_null() {
            return "none".to_string();
        }
        let mut buffer = [0u16; 128];
        let length = GetClassNameW(foreground, &mut buffer);
        String::from_utf16_lossy(&buffer[..length.max(0) as usize])
    }
}

/// The desktop is a full-bleed window, but the island lives on top of it.
const DESKTOP_WINDOW_CLASSES: [&str; 2] = ["Progman", "WorkerW"];

fn is_fullscreen() -> bool {
    unsafe {
        let foreground = GetForegroundWindow();
        if foreground.0.is_null() {
            return false;
        }

        let mut class_buffer = [0u16; 64];
        let class_length = GetClassNameW(foreground, &mut class_buffer);
        let class = String::from_utf16_lossy(&class_buffer[..class_length.max(0) as usize]);
        if DESKTOP_WINDOW_CLASSES.contains(&class.as_str()) {
            return false;
        }

        if let Ok(state) = SHQueryUserNotificationState() {
            if state == QUNS_RUNNING_D3D_FULL_SCREEN
                || state == QUNS_PRESENTATION_MODE
                || state == QUNS_BUSY
            {
                return true;
            }
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
