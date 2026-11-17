#[path = "../src/local_player.rs"]
mod local_player;
#[path = "../src/media_snapshot.rs"]
mod media_snapshot;
#[path = "../src/music_library.rs"]
mod music_library;
#[path = "../src/music_queue.rs"]
mod music_queue;

use local_player::LocalPlayer;
use std::path::Path;
use std::time::Duration;
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

mod settings {
    use std::path::PathBuf;
    use std::sync::OnceLock;

    pub fn data_dir() -> PathBuf {
        static DIRECTORY: OnceLock<PathBuf> = OnceLock::new();
        DIRECTORY
            .get_or_init(|| {
                std::env::temp_dir().join(format!("winx-local-player-check-{}", std::process::id()))
            })
            .clone()
    }
}

mod logger {
    pub fn log(message: impl AsRef<str>) {
        eprintln!("{}", message.as_ref());
    }
}

fn write_silent_wav(path: &Path) -> std::io::Result<()> {
    let data_length = 22_050_u32 * 2 * 4;
    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"RIFF");
    bytes.extend_from_slice(&(36 + data_length).to_le_bytes());
    bytes.extend_from_slice(b"WAVEfmt ");
    bytes.extend_from_slice(&16_u32.to_le_bytes());
    bytes.extend_from_slice(&1_u16.to_le_bytes());
    bytes.extend_from_slice(&1_u16.to_le_bytes());
    bytes.extend_from_slice(&22_050_u32.to_le_bytes());
    bytes.extend_from_slice(&44_100_u32.to_le_bytes());
    bytes.extend_from_slice(&2_u16.to_le_bytes());
    bytes.extend_from_slice(&16_u16.to_le_bytes());
    bytes.extend_from_slice(b"data");
    bytes.extend_from_slice(&data_length.to_le_bytes());
    bytes.resize(bytes.len() + data_length as usize, 0);
    std::fs::write(path, bytes)
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    unsafe { RoInitialize(RO_INIT_MULTITHREADED)? };
    let directory = settings::data_dir();
    std::fs::create_dir_all(&directory)?;
    if std::env::args().nth(1).as_deref() == Some("--probe-folder") {
        let root = std::env::args().nth(2).ok_or("Missing folder argument")?;
        let scan = music_library::scan_folders(&[std::path::PathBuf::from(root)]);
        println!(
            "PROBE: {} audio files, {} unreadable folders",
            scan.tracks.len(),
            scan.skipped_folders
        );
        assert!(!scan.tracks.is_empty());
        for (index, track) in scan.tracks.iter().enumerate() {
            let saved = serde_json::json!({ "tracks": [track], "index": 0, "use_local": true });
            std::fs::write(
                directory.join("local-player.json"),
                serde_json::to_vec(&saved)?,
            )?;
            let probe = LocalPlayer::new().await?;
            tokio::time::sleep(Duration::from_millis(500)).await;
            let state = probe.snapshot()?;
            assert!(state.playback_error.is_none(), "{:?}", state.playback_error);
            assert!(
                state.duration_ms > 0,
                "Audio duration not loaded for item {}",
                index + 1
            );
            assert!(!state.playing);
            println!(
                "PROBE: item {} decoded while paused, duration {} ms",
                index + 1,
                state.duration_ms
            );
        }
        return Ok(());
    }
    let first = directory.join("prueba canción uno.wav");
    let second = directory.join("second track.wav");
    write_silent_wav(&first)?;
    write_silent_wav(&second)?;
    let mut player = LocalPlayer::new().await?;
    assert!(!player.active());
    player
        .open(vec![
            first.display().to_string(),
            second.display().to_string(),
        ])
        .await?;
    tokio::time::sleep(Duration::from_millis(700)).await;
    let state = player.snapshot()?;
    assert!(
        state.available && state.playing,
        "{:?}",
        state.playback_error
    );
    assert!(state.duration_ms >= 3_900, "duration {}", state.duration_ms);
    assert!(state.position_ms > 0, "position {}", state.position_ms);
    assert_eq!(state.queue_length, 2);
    println!("LOCAL-07 OK: native playback advances without external Media Player");

    player.control("play_pause", 0).await?;
    tokio::time::sleep(Duration::from_millis(150)).await;
    let paused = player.snapshot()?;
    assert!(!paused.playing);
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert!((player.snapshot()?.position_ms - paused.position_ms).abs() < 50);
    player.control("seek", 2_000).await?;
    tokio::time::sleep(Duration::from_millis(150)).await;
    assert!((player.snapshot()?.position_ms - 2_000).abs() < 200);
    player.control("play_pause", 0).await?;
    tokio::time::sleep(Duration::from_millis(150)).await;
    assert!(player.snapshot()?.playing);
    println!("LOCAL-08 OK: pause, seek and resume use the native engine");

    player.control("next", 0).await?;
    tokio::time::sleep(Duration::from_millis(250)).await;
    assert_eq!(player.snapshot()?.queue_index, 1);
    player.control("prev", 0).await?;
    tokio::time::sleep(Duration::from_millis(250)).await;
    assert_eq!(player.snapshot()?.queue_index, 0);
    player.control("seek", 3_900).await?;
    tokio::time::sleep(Duration::from_millis(650)).await;
    player.tick().await?;
    tokio::time::sleep(Duration::from_millis(250)).await;
    assert_eq!(player.snapshot()?.queue_index, 1);
    println!("LOCAL-09 OK: next, previous and automatic advance preserve queue order");

    player.control("seek", 3_900).await?;
    tokio::time::sleep(Duration::from_millis(650)).await;
    player.tick().await?;
    assert_eq!(player.snapshot()?.queue_index, 1);
    assert!(!player.snapshot()?.playing);
    player.control("play_pause", 0).await?;
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert!(player.snapshot()?.playing);
    assert!(player.snapshot()?.position_ms < 1_000);
    println!("LOCAL-10 OK: final track stops and Play restarts it");

    player.open(vec![]).await?;
    assert_eq!(player.snapshot()?.queue_length, 2);
    player.control("play_pause", 0).await?;
    let restored = LocalPlayer::new().await?;
    tokio::time::sleep(Duration::from_millis(250)).await;
    assert!(restored.active());
    assert_eq!(restored.snapshot()?.queue_index, 1);
    assert!(!restored.snapshot()?.playing);
    println!("LOCAL-11 OK: cancellation preserves selection; queue restores paused");

    player.use_system()?;
    assert!(!player.active());
    assert!(!player.snapshot()?.playing);
    let system = LocalPlayer::new().await?;
    assert!(!system.active());
    println!("LOCAL-12 OK: switching to Windows controls stops local playback and persists mode");

    let missing = directory.join("missing.wav").display().to_string();
    let error = player
        .open(vec![missing])
        .await
        .expect_err("missing file must fail");
    player.set_error(error.to_string());
    let failed = player.snapshot()?;
    assert!(failed.playback_error.is_some());
    assert!(!failed.playing && !failed.can_seek);
    assert_eq!(failed.duration_ms, 0);
    player.open(vec![first.display().to_string()]).await?;
    tokio::time::sleep(Duration::from_millis(300)).await;
    assert!(player.snapshot()?.playing);
    println!("LOCAL-13 OK: missing-file error is visible and a new selection recovers playback");
    let third = directory.join("nested").join("third.WAV");
    std::fs::create_dir_all(third.parent().unwrap())?;
    write_silent_wav(&third)?;
    std::fs::write(directory.join("cover.jpg"), b"not music")?;
    std::fs::write(directory.join("notes.mp3.txt"), b"not music")?;
    let scan = music_library::scan_folders(&[directory.clone(), directory.join("nested")]);
    assert_eq!(scan.tracks.len(), 3);
    assert_eq!(scan.skipped_folders, 0);
    println!(
        "FOLDER-09 OK: Windows scan finds nested audio and ignores documents without duplication"
    );

    let before = player.snapshot()?;
    player
        .add(vec![
            second.display().to_string(),
            first.display().to_string(),
        ])
        .await?;
    let added = player.snapshot()?;
    assert_eq!(added.queue_length, 2);
    assert_eq!(added.queue_index, before.queue_index);
    assert!(added.playing);
    assert!(added.position_ms >= before.position_ms - 50);
    player.control("play_pause", 0).await?;
    tokio::time::sleep(Duration::from_millis(100)).await;
    let paused = player.snapshot()?;
    player.add(scan.tracks).await?;
    let extended = player.snapshot()?;
    assert_eq!(extended.queue_length, 3);
    assert_eq!(extended.queue_index, paused.queue_index);
    assert!(!extended.playing);
    assert!((extended.position_ms - paused.position_ms).abs() < 50);
    let restored = LocalPlayer::new().await?;
    assert_eq!(restored.snapshot()?.queue_length, 3);
    println!("FOLDER-10 OK: importing preserves playback, pause, current track and saved queue");
    player.use_system()?;
    player.add(vec![second.display().to_string()]).await?;
    tokio::time::sleep(Duration::from_millis(150)).await;
    assert!(player.active());
    assert_eq!(player.snapshot()?.queue_length, 3);
    assert!(player.snapshot()?.playing);
    println!("FOLDER-11 OK: choosing existing folders in Windows mode resumes the local queue without duplicates");
    player.control("repeat", 0).await?;
    assert_eq!(player.snapshot()?.repeat_mode, "all");
    player.control("repeat", 0).await?;
    assert_eq!(player.snapshot()?.repeat_mode, "one");
    let repeated_index = player.snapshot()?.queue_index;
    player.control("seek", 3_900).await?;
    tokio::time::sleep(Duration::from_millis(650)).await;
    player.tick().await?;
    tokio::time::sleep(Duration::from_millis(250)).await;
    let repeated = player.snapshot()?;
    assert_eq!(repeated.queue_index, repeated_index);
    assert!(repeated.playing && repeated.position_ms < 1_500);
    player.control("next", 0).await?;
    assert_ne!(player.snapshot()?.queue_index, repeated_index);
    player.control("repeat", 0).await?;
    assert_eq!(player.snapshot()?.repeat_mode, "off");
    player.control("repeat", 0).await?;
    while player.snapshot()?.queue_index + 1 < player.snapshot()?.queue_length {
        player.control("next", 0).await?;
    }
    tokio::time::sleep(Duration::from_millis(350)).await;
    assert!(player.snapshot()?.can_seek);
    player.control("seek", 3_900).await?;
    tokio::time::sleep(Duration::from_millis(650)).await;
    player.tick().await?;
    tokio::time::sleep(Duration::from_millis(250)).await;
    assert_eq!(player.snapshot()?.queue_index, 0);
    assert!(player.snapshot()?.playing);
    println!("MODE-LIVE-01 OK: repeat-one replays, manual next advances and repeat-all wraps");
    player.control("play_pause", 0).await?;
    tokio::time::sleep(Duration::from_millis(200)).await;
    let before_modes = player.snapshot()?;
    assert!(!before_modes.playing);
    player.control("shuffle", 0).await?;
    let modes = player.snapshot()?;
    assert!(modes.shuffle_enabled);
    assert_eq!(modes.playing, before_modes.playing);
    assert_eq!(modes.queue_index, before_modes.queue_index);
    let restored_modes = LocalPlayer::new().await?;
    let restored_modes = restored_modes.snapshot()?;
    assert!(restored_modes.shuffle_enabled);
    assert_eq!(restored_modes.repeat_mode, "all");
    player.control("next", 0).await?;
    assert_ne!(player.snapshot()?.queue_index, before_modes.queue_index);
    player.control("prev", 0).await?;
    assert_eq!(player.snapshot()?.queue_index, before_modes.queue_index);
    println!("MODE-LIVE-02 OK: modes persist without starting playback, shuffle previous follows history");
    player.use_system()?;
    Ok(())
}
