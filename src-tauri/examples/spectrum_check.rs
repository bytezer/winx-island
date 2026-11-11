#[path = "../src/audio_capture.rs"]
mod audio_capture;
#[path = "../src/audio_samples.rs"]
mod audio_samples;
#[path = "../src/spectrum.rs"]
mod spectrum;

use std::time::Duration;
use windows::Foundation::TimeSpan;
use windows::Media::Core::MediaSource;
use windows::Media::Playback::MediaPlayer;
use windows::Storage::StorageFile;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

fn fixture() -> std::io::Result<std::path::PathBuf> {
    let rate = 48_000_u32;
    let frames = rate * 3;
    let length = frames * 2;
    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"RIFF");
    bytes.extend_from_slice(&(36 + length).to_le_bytes());
    bytes.extend_from_slice(b"WAVEfmt ");
    bytes.extend_from_slice(&16_u32.to_le_bytes());
    bytes.extend_from_slice(&1_u16.to_le_bytes());
    bytes.extend_from_slice(&1_u16.to_le_bytes());
    bytes.extend_from_slice(&rate.to_le_bytes());
    bytes.extend_from_slice(&(rate * 2).to_le_bytes());
    bytes.extend_from_slice(&2_u16.to_le_bytes());
    bytes.extend_from_slice(&16_u16.to_le_bytes());
    bytes.extend_from_slice(b"data");
    bytes.extend_from_slice(&length.to_le_bytes());
    for index in 0..frames {
        let frequency = if index < frames / 2 { 80.0 } else { 8_000.0 };
        let sample = (std::f32::consts::TAU * index as f32 * frequency / rate as f32).sin() * 0.03;
        bytes.extend_from_slice(&((sample * i16::MAX as f32) as i16).to_le_bytes());
    }
    let path = std::env::temp_dir().join(format!("winx-spectrum-check-{}.wav", std::process::id()));
    std::fs::write(&path, bytes)?;
    Ok(path)
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok()? };
    let (device, id) = audio_capture::default_device()?;
    let mut capture = audio_capture::Loopback::open(device, id)?;
    println!("FFT-LIVE: loopback opened at {} Hz", capture.sample_rate);
    if std::env::args().any(|argument| argument == "--live") {
        let mut minimum = [1.0_f32; 7];
        let mut maximum = [0.0_f32; 7];
        let mut peak = 0.0_f32;
        for _ in 0..90 {
            tokio::time::sleep(Duration::from_millis(33)).await;
            let frame = capture.read()?;
            peak = peak.max(frame.level);
            for index in 0..7 {
                minimum[index] = minimum[index].min(frame.bands[index]);
                maximum[index] = maximum[index].max(frame.bands[index]);
            }
        }
        println!("FFT-LIVE: peak {peak:.5}, minima {minimum:.3?}, maxima {maximum:.3?}");
        assert!(peak > 0.0001, "No audible output during the live probe");
        assert!(
            maximum
                .iter()
                .zip(minimum)
                .filter(|(maximum, minimum)| **maximum - *minimum > 0.05)
                .count()
                >= 3
        );
        println!("FFT-LIVE OK: independent bands change with real Windows output");
        return Ok(());
    }
    let file = fixture()?;
    let storage = StorageFile::GetFileFromPathAsync(&file.display().to_string().into())?.await?;
    let player = MediaPlayer::new()?;
    player.CommandManager()?.SetIsEnabled(false)?;
    player.SystemMediaTransportControls()?.SetIsEnabled(false)?;
    player.SetSource(&MediaSource::CreateFromStorageFile(&storage)?)?;
    player
        .PlaybackSession()?
        .SetPosition(TimeSpan { Duration: 0 })?;
    player.Play()?;
    let mut bass_seen = false;
    let mut treble_seen = false;
    let mut final_bands = [0.0; 7];
    for _ in 0..180 {
        tokio::time::sleep(Duration::from_millis(33)).await;
        let frame = capture.read()?;
        bass_seen |= frame.bands[0] > 0.2 && frame.bands[0] > frame.bands[6] + 0.15;
        treble_seen |= frame.bands[6] > 0.2 && frame.bands[6] > frame.bands[0] + 0.15;
        final_bands = frame.bands;
    }
    player.Pause()?;
    assert!(bass_seen, "Bass tone did not drive the low-frequency bar");
    assert!(
        treble_seen,
        "Treble tone did not drive the high-frequency bar"
    );
    assert!(
        final_bands.iter().all(|band| *band < 0.015),
        "Spectrum did not settle after silence: {final_bands:?}"
    );
    println!(
        "FFT-LIVE OK: quiet bass and treble drive separate bars, then silence resets all bands"
    );
    Ok(())
}
