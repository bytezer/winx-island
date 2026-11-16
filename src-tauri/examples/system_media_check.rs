#[path = "../src/media_choice.rs"]
mod media_choice;
#[path = "../src/media_snapshot.rs"]
mod media_snapshot;
#[path = "../src/system_media.rs"]
mod system_media;
use std::time::Duration;
use system_media::SystemMedia;
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    unsafe { RoInitialize(RO_INIT_MULTITHREADED)?; }
    let mut system = SystemMedia::new();
    if std::env::args().any(|arg| arg == "--list") {
        system.refresh().await?;
        for entry in &system.entries {
            println!("SOURCE {} label={} playing={} seek={} toggle={}", entry.id, media_choice::source_label(&entry.snapshot.source_app), entry.snapshot.playing, entry.snapshot.can_seek, entry.snapshot.can_play_pause);
        }
        return Ok(());
    }
    let mut id = None;
    for _ in 0..60 {
        system.refresh().await?;
        id = system.entries.iter().find(|entry| entry.snapshot.title == "winx compatibility fixture").map(|entry| entry.id.clone());
        if id.is_some() { break; }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    let id = id.ok_or("Browser fixture session was not published to Windows")?;
    let snapshot = system.snapshot(&id).await?;
    assert!(snapshot.available && snapshot.playing && snapshot.can_play_pause);
    assert!(snapshot.duration_ms > 0);
    println!("SYSTEM-01 OK: real browser session, metadata, timeline and controls enumerated");
    system.control(&id, "play_pause", 0).await?;
    tokio::time::sleep(Duration::from_millis(300)).await;
    system.refresh().await?;
    assert!(!system.snapshot(&id).await?.playing);
    println!("SYSTEM-02 OK: exact browser session paused and identity survives refresh");
    system.control(&id, "play_pause", 0).await?;
    tokio::time::sleep(Duration::from_millis(300)).await;
    system.refresh().await?;
    assert!(system.snapshot(&id).await?.playing);
    if system.snapshot(&id).await?.can_seek {
        system.control(&id, "seek", 3000).await?;
        tokio::time::sleep(Duration::from_millis(250)).await;
        system.refresh().await?;
        let position = system.snapshot(&id).await?.position_ms;
        assert!((position - 3250).abs() < 1500, "seek position {position}");
        println!("SYSTEM-03 OK: native seek reaches the browser's media element");
    } else { println!("SYSTEM-03 NOT RUN: browser did not advertise seeking"); }
    assert!(system.control(&id, "unsupported", 0).await.is_err());
    system.control(&id, "play_pause", 0).await?;
    println!("SYSTEM-04 OK: unsupported command rejected; fixture paused after test");
    Ok(())
}
