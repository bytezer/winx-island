//! Audio spectrum for the visualizer.
//!
//! Captures the default render endpoint with WASAPI loopback, runs an in-repo
//! radix-2 FFT and pushes 24 smoothed bands to the frontend on
//! `island://spectrum`. Everything runs on one thread: the capture interfaces
//! are only touched there, and emitting is skipped while the island is hidden
//! or the visualizer setting is off.

mod capture;
mod spectrum;

use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

use crate::logger::logline;
use crate::settings::Settings;

use capture::Capture;
use spectrum::{Analyzer, BANDS};

const FRAME_INTERVAL: Duration = Duration::from_millis(33);
/// The default output device can change (headphones, docks), so re-resolve.
const DEVICE_REFRESH_FRAMES: u32 = 120;

#[derive(Clone, Serialize)]
struct SpectrumPayload {
    bands: Vec<f32>,
}

/// Capture plus the analyser calibrated for its sample rate.
struct Source {
    capture: Capture,
    analyzer: Analyzer,
}

pub fn spawn(app: AppHandle, settings: Arc<Settings>) {
    std::thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let mut source: Option<Source> = None;
        let mut frames_since_refresh: u32 = DEVICE_REFRESH_FRAMES;
        let mut logged = false;

        loop {
            std::thread::sleep(FRAME_INTERVAL);
            frames_since_refresh = frames_since_refresh.saturating_add(1);

            let Some(window) = app.get_webview_window("island") else {
                continue;
            };
            let visible = window.is_visible().unwrap_or(false);
            if !visible || !settings.visualizer_enabled() {
                // Dropping the stream stops the capture: the endpoint would
                // otherwise keep buffering audio we are not allowed to read.
                source = None;
                continue;
            }

            if frames_since_refresh >= DEVICE_REFRESH_FRAMES || source.is_none() {
                frames_since_refresh = 0;
                source = open_source();
            }
            let Some(current) = source.as_mut() else {
                continue;
            };

            let frames = match current.capture.pump() {
                Ok(frames) => frames,
                Err(error) => {
                    logline!("loopback capture failed, re-resolving: {error}");
                    source = None;
                    continue;
                }
            };
            if frames == 0 {
                current.capture.push_idle();
            }

            let Some(samples) = current.capture.latest_window() else {
                continue;
            };
            let bands = current.analyzer.analyze(&samples);

            if !logged {
                logline!("spectrum channel active, {BANDS} bands");
                logged = true;
            }
            let _ = app.emit("island://spectrum", SpectrumPayload { bands: bands.to_vec() });
        }
    });
}

fn open_source() -> Option<Source> {
    match Capture::open() {
        Ok(capture) => {
            let analyzer = Analyzer::new(capture.sample_rate());
            Some(Source { capture, analyzer })
        }
        Err(error) => {
            logline!("no loopback capture available: {error}");
            None
        }
    }
}
