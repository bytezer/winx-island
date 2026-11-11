//! WASAPI loopback capture from the default render endpoint.
//!
//! Opens a shared-mode loopback stream on the default output device and keeps
//! the most recent 2048 mono samples in a ring buffer. The audio thread calls
//! `pump` once per tick and `latest_window` to hand a frame to the analyser.

use windows::core::Result;
use windows::Win32::Foundation::E_FAIL;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator,
    AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
    WAVEFORMATEX,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL};

use super::spectrum::FFT_SIZE;

/// Analyse window in samples.
const WINDOW: usize = FFT_SIZE;

const WAVE_FORMAT_PCM: u16 = 1;
const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;
const WAVE_FORMAT_EXTENSIBLE: u16 = 0xFFFE;

#[derive(Clone, Copy)]
enum SampleFormat {
    Float32,
    Pcm16,
}

impl SampleFormat {
    /// Shared-mode mix formats are usually WAVE_FORMAT_EXTENSIBLE with the bit
    /// depth identifying the payload; anything else is rejected, not guessed.
    fn detect(tag: u16, bits: u16) -> Option<Self> {
        match (tag, bits) {
            (WAVE_FORMAT_IEEE_FLOAT, 32) | (WAVE_FORMAT_EXTENSIBLE, 32) => Some(Self::Float32),
            (WAVE_FORMAT_PCM, 16) | (WAVE_FORMAT_EXTENSIBLE, 16) => Some(Self::Pcm16),
            _ => None,
        }
    }
}

pub struct Capture {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    format: SampleFormat,
    channels: usize,
    sample_rate: u32,
    ring: [f32; WINDOW],
    cursor: usize,
    filled: usize,
}

impl Capture {
    pub fn open() -> Result<Self> {
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
            let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;

            let mix = client.GetMixFormat()?;
            let header: WAVEFORMATEX = *mix;
            let format = SampleFormat::detect(header.wFormatTag, header.wBitsPerSample)
                .ok_or_else(|| windows::core::Error::new(E_FAIL, "unsupported mix format"))?;

            let initialized = client.Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK,
                0,
                0,
                mix,
                None,
            );
            CoTaskMemFree(Some(mix as *const core::ffi::c_void));
            initialized?;

            let capture: IAudioCaptureClient = client.GetService()?;
            client.Start()?;

            Ok(Self {
                client,
                capture,
                format,
                channels: header.nChannels.max(1) as usize,
                sample_rate: header.nSamplesPerSec,
                ring: [0.0; WINDOW],
                cursor: 0,
                filled: 0,
            })
        }
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// Drains every packet currently queued by the endpoint and returns how
    /// many frames reached the ring. Zero means the endpoint is idle: nothing
    /// is rendering, so WASAPI has no loopback packets to hand over.
    pub fn pump(&mut self) -> Result<usize> {
        let mut pushed = 0_usize;

        unsafe {
            loop {
                let available = self.capture.GetNextPacketSize()?;
                if available == 0 {
                    break;
                }

                let mut data: *mut u8 = std::ptr::null_mut();
                let mut frames: u32 = 0;
                let mut flags: u32 = 0;
                self.capture
                    .GetBuffer(&mut data, &mut frames, &mut flags, None, None)?;

                if flags as i32 & AUDCLNT_BUFFERFLAGS_SILENT.0 != 0 || data.is_null() {
                    self.push_silence(frames as usize);
                } else {
                    match self.format {
                        SampleFormat::Float32 => self.push_float32(data, frames as usize),
                        SampleFormat::Pcm16 => self.push_pcm16(data, frames as usize),
                    }
                }

                self.capture.ReleaseBuffer(frames)?;
                pushed += frames as usize;
            }
        }

        Ok(pushed)
    }

    /// Feeds one tick of silence so the analysis window keeps rolling while the
    /// endpoint is idle; without this the bands would freeze on the last packet.
    pub fn push_idle(&mut self) {
        let frames = (self.sample_rate / 30).max(1) as usize;
        self.push_silence(frames);
    }

    /// Most recent WINDOW samples, oldest first, once the ring has filled.
    pub fn latest_window(&self) -> Option<[f32; WINDOW]> {
        if self.filled < WINDOW {
            return None;
        }

        let mut window = [0.0_f32; WINDOW];
        window[..WINDOW - self.cursor].copy_from_slice(&self.ring[self.cursor..]);
        window[WINDOW - self.cursor..].copy_from_slice(&self.ring[..self.cursor]);
        Some(window)
    }

    unsafe fn push_float32(&mut self, data: *const u8, frames: usize) {
        let samples = std::slice::from_raw_parts(data as *const f32, frames * self.channels);
        for frame in samples.chunks_exact(self.channels) {
            self.push(average(frame.iter().copied(), self.channels));
        }
    }

    unsafe fn push_pcm16(&mut self, data: *const u8, frames: usize) {
        let samples = std::slice::from_raw_parts(data as *const i16, frames * self.channels);
        for frame in samples.chunks_exact(self.channels) {
            let scaled = frame.iter().map(|sample| *sample as f32 / 32_768.0);
            self.push(average(scaled, self.channels));
        }
    }

    fn push_silence(&mut self, frames: usize) {
        for _ in 0..frames {
            self.push(0.0);
        }
    }

    /// Pushes one mono sample, dropping anything outside full scale.
    fn push(&mut self, sample: f32) {
        self.ring[self.cursor] = sample.clamp(-1.0, 1.0);
        self.cursor = (self.cursor + 1) % WINDOW;
        self.filled = (self.filled + 1).min(WINDOW);
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        unsafe {
            let _ = self.client.Stop();
        }
    }
}

fn average(samples: impl Iterator<Item = f32>, channels: usize) -> f32 {
    samples.sum::<f32>() / channels as f32
}
