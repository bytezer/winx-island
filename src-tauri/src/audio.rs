//! Peak meter for the mini visualizer.
//!
//! Reads the render peak of the default output device with IAudioMeter
//! Information and pushes a smoothed level to the frontend. No loopback
//! capture, no per-app data: one number, 0..1, around 30 samples per second.

use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

use crate::logger::logline;
use crate::settings::Settings;

const FRAME_INTERVAL: Duration = Duration::from_millis(33);
const EMIT_THRESHOLD: f32 = 0.02;
const ATTACK: f32 = 0.5;
const RELEASE: f32 = 0.25;
/// The default output device can change (headphones, docks), so re-resolve.
const DEVICE_REFRESH_FRAMES: u32 = 120;

#[derive(Clone, Copy, Serialize)]
struct LevelPayload {
    level: f32,
}

struct Meter {
    meter: IAudioMeterInformation,
}

pub fn spawn(app: AppHandle, settings: Arc<Settings>) {
    std::thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let mut smooth = 0.0_f32;
        let mut emitted = -1.0_f32;
        let mut meter: Option<Meter> = None;
        let mut frames_since_refresh: u32 = DEVICE_REFRESH_FRAMES;

        loop {
            std::thread::sleep(FRAME_INTERVAL);
            frames_since_refresh = frames_since_refresh.saturating_add(1);

            let Some(window) = app.get_webview_window("island") else {
                continue;
            };
            let visible = window.is_visible().unwrap_or(false);
            if !visible || !settings.visualizer_enabled() {
                continue;
            }

            if frames_since_refresh >= DEVICE_REFRESH_FRAMES || meter.is_none() {
                frames_since_refresh = 0;
                meter = resolve_meter();
            }
            let Some(current) = meter.as_ref() else {
                continue;
            };

            let peak = match unsafe { current.meter.GetPeakValue() } {
                Ok(value) => value.clamp(0.0, 1.0),
                Err(error) => {
                    // Drop the dead device and re-resolve on the next frame.
                    logline!("peak read failed, re-resolving: {error}");
                    meter = None;
                    continue;
                }
            };

            smooth += (peak - smooth) * if peak > smooth { ATTACK } else { RELEASE };

            if (smooth - emitted).abs() >= EMIT_THRESHOLD {
                if emitted < 0.0 {
                    logline!("level channel active, first sample {smooth:.3}");
                }
                emitted = smooth;
                let _ = app.emit("island://level", LevelPayload { level: smooth });
            }
        }
    });
}

fn resolve_meter() -> Option<Meter> {
    let result = (|| -> windows::core::Result<IAudioMeterInformation> {
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
            device.Activate(CLSCTX_ALL, None)
        }
    })();

    match result {
        Ok(meter) => Some(Meter { meter }),
        Err(error) => {
            logline!("no peak meter available: {error}");
            None
        }
    }
}
