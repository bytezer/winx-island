use windows::core::{Error, Result, GUID};
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDevice, IMMDeviceEnumerator,
    MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_LOOPBACK, WAVEFORMATEXTENSIBLE,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL};

use crate::audio_samples::SampleEncoding;
use crate::spectrum::{Spectrum, BAND_COUNT};

pub struct AudioFrame {
    pub level: f32,
    pub bands: [f32; BAND_COUNT],
}

pub struct Loopback {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    encoding: SampleEncoding,
    channels: usize,
    block_align: usize,
    pub sample_rate: u32,
    pub device_id: String,
    analyzer: Spectrum,
    level: f32,
}

pub fn default_device() -> Result<(IMMDevice, String)> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let pointer = device.GetId()?;
        let id = pointer.to_string();
        CoTaskMemFree(Some(pointer.0.cast()));
        Ok((device, id?))
    }
}

impl Loopback {
    pub fn open(device: IMMDevice, device_id: String) -> Result<Self> {
        unsafe {
            let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
            let pointer = client.GetMixFormat()?;
            let format = *pointer;
            let tag = if format.wFormatTag == 0xfffe && format.cbSize >= 22 {
                let subtype = (*pointer.cast::<WAVEFORMATEXTENSIBLE>()).SubFormat;
                if subtype == GUID::from_u128(0x00000003_0000_0010_8000_00aa00389b71) {
                    3
                } else if subtype == GUID::from_u128(0x00000001_0000_0010_8000_00aa00389b71) {
                    1
                } else {
                    0
                }
            } else {
                format.wFormatTag
            };
            let encoding = match (tag, format.wBitsPerSample) {
                (3, 32) => Some(SampleEncoding::Float32),
                (1, 16) => Some(SampleEncoding::Pcm16),
                (1, 24) => Some(SampleEncoding::Pcm24),
                (1, 32) => Some(SampleEncoding::Pcm32),
                _ => None,
            };
            let valid = encoding.is_some()
                && format.nChannels > 0
                && format.nChannels <= 32
                && format.nSamplesPerSec >= 8_000
                && usize::from(format.nBlockAlign)
                    >= usize::from(format.nChannels) * encoding.unwrap().bytes();
            let initialized = if valid {
                client.Initialize(
                    AUDCLNT_SHAREMODE_SHARED,
                    AUDCLNT_STREAMFLAGS_LOOPBACK,
                    1_000_000,
                    0,
                    pointer,
                    None,
                )
            } else {
                Err(Error::new(
                    windows::core::HRESULT(0x80070057_u32 as i32),
                    "Unsupported output audio format",
                ))
            };
            CoTaskMemFree(Some(pointer.cast()));
            initialized?;
            let capture: IAudioCaptureClient = client.GetService()?;
            client.Start()?;
            Ok(Self {
                client,
                capture,
                encoding: encoding.unwrap(),
                channels: usize::from(format.nChannels),
                block_align: usize::from(format.nBlockAlign),
                sample_rate: format.nSamplesPerSec,
                device_id,
                analyzer: Spectrum::new(),
                level: 0.0,
            })
        }
    }

    pub fn read(&mut self) -> Result<AudioFrame> {
        let mut frames_read = 0;
        let mut peak = 0.0_f32;
        unsafe {
            while self.capture.GetNextPacketSize()? > 0 {
                let mut pointer = std::ptr::null_mut();
                let mut frames = 0;
                let mut flags = 0;
                self.capture
                    .GetBuffer(&mut pointer, &mut frames, &mut flags, None, None)?;
                let silent = pointer.is_null() || flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0;
                let bytes = if silent {
                    &[][..]
                } else {
                    std::slice::from_raw_parts(pointer, frames as usize * self.block_align)
                };
                for index in 0..frames as usize {
                    let sample = if silent {
                        0.0
                    } else {
                        let frame =
                            &bytes[index * self.block_align..(index + 1) * self.block_align];
                        (0..self.channels)
                            .map(|channel| {
                                self.encoding
                                    .decode(&frame[channel * self.encoding.bytes()..])
                            })
                            .sum::<f32>()
                            / self.channels as f32
                    };
                    peak = peak.max(sample.abs());
                    self.analyzer.push(sample);
                }
                self.capture.ReleaseBuffer(frames)?;
                frames_read += frames;
            }
        }
        if frames_read == 0 {
            for _ in 0..self.sample_rate / 30 {
                self.analyzer.push(0.0);
            }
        }
        self.level = peak.max(self.level * 0.65);
        if self.level < 0.0001 {
            self.level = 0.0;
        }
        Ok(AudioFrame {
            level: self.level,
            bands: self.analyzer.analyze(self.sample_rate),
        })
    }
}

impl Drop for Loopback {
    fn drop(&mut self) {
        let _ = unsafe { self.client.Stop() };
    }
}
