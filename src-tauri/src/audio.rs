use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

use crate::audio_capture::{default_device, Loopback};
use crate::logger::logline;
use crate::settings::Settings;
use crate::spectrum::BAND_COUNT;

const FRAME_INTERVAL: Duration = Duration::from_millis(33);
const DEVICE_REFRESH_FRAMES: u32 = 120;

#[derive(Clone, Copy, Serialize)]
struct LevelPayload {
    level: f32,
    bands: [f32; BAND_COUNT],
}

pub fn spawn(app: AppHandle, settings: Arc<Settings>) {
    std::thread::spawn(move || {
        if let Err(error) = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok() } {
            logline!("audio initialization failed: {error}");
            return;
        }
        let mut capture: Option<Loopback> = None;
        let mut refresh = DEVICE_REFRESH_FRAMES;
        let mut last_error = String::new();
        let mut enabled = true;
        loop {
            std::thread::sleep(FRAME_INTERVAL);
            let visible = app
                .get_webview_window("island")
                .is_some_and(|window| window.is_visible().unwrap_or(false));
            if !visible || !settings.visualizer_enabled() {
                if enabled {
                    capture = None;
                    refresh = DEVICE_REFRESH_FRAMES;
                    let _ = app.emit(
                        "island://level",
                        LevelPayload {
                            level: 0.0,
                            bands: [0.0; BAND_COUNT],
                        },
                    );
                    enabled = false;
                }
                continue;
            }
            enabled = true;
            refresh = refresh.saturating_add(1);
            if refresh >= DEVICE_REFRESH_FRAMES {
                refresh = 0;
                let result = default_device().and_then(|(device, id)| {
                    if capture
                        .as_ref()
                        .is_some_and(|capture| capture.device_id == id)
                    {
                        return Ok(None);
                    }
                    Loopback::open(device, id).map(Some)
                });
                match result {
                    Ok(Some(next)) => {
                        logline!(
                            "FFT spectrum channel active: {} Hz, {BAND_COUNT} bands",
                            next.sample_rate
                        );
                        capture = Some(next);
                        last_error.clear();
                    }
                    Ok(None) => {}
                    Err(error) => {
                        let message = error.to_string();
                        if message != last_error {
                            logline!("spectrum capture unavailable: {message}");
                            last_error = message;
                        }
                        capture = None;
                    }
                }
            }
            let payload = if let Some(current) = capture.as_mut() {
                match current.read() {
                    Ok(frame) => LevelPayload {
                        level: frame.level,
                        bands: frame.bands,
                    },
                    Err(error) => {
                        logline!("spectrum read failed, re-resolving: {error}");
                        capture = None;
                        refresh = DEVICE_REFRESH_FRAMES;
                        LevelPayload {
                            level: 0.0,
                            bands: [0.0; BAND_COUNT],
                        }
                    }
                }
            } else {
                LevelPayload {
                    level: 0.0,
                    bands: [0.0; BAND_COUNT],
                }
            };
            let _ = app.emit("island://level", payload);
        }
    });
}
