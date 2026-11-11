use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio::time::{sleep, Duration};
use windows::core::Interface;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession, GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::{DataReader, IRandomAccessStreamReference, IInputStream};
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

use crate::logger::logline;

const POLL_INTERVAL: Duration = Duration::from_millis(700);
const MAX_ART_BYTES: u32 = 8 * 1024 * 1024;

pub use crate::media_snapshot::MediaSnapshot;

pub enum Command {
    Transport(String),
    Seek(i64),
    OpenFiles(Vec<String>),
    AddFiles(Vec<String>),
    UseSystem,
    Refresh,
}

/// Handle owned by the IPC layer. WinRT objects are not `Send`, so every media
/// call happens on the dedicated polling thread; commands are queued to it.
#[derive(Clone)]
pub struct Controller {
    sender: UnboundedSender<Command>,
}

impl Controller {
    pub fn send(&self, command: Command) -> Result<(), String> {
        self.sender.send(command).map_err(|error| error.to_string())
    }
}

pub fn channel() -> (Controller, UnboundedReceiver<Command>) {
    let (sender, receiver) = unbounded_channel();
    (Controller { sender }, receiver)
}

pub fn spawn(app: AppHandle, mut receiver: UnboundedReceiver<Command>) {
    std::thread::spawn(move || {
        // SMTC is apartment agnostic, but activation still needs COM.
        unsafe {
            let _ = RoInitialize(RO_INIT_MULTITHREADED);
        }

        let runtime = match tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
        {
            Ok(runtime) => runtime,
            Err(error) => {
                logline!("unable to build the media runtime: {error}");
                return;
            }
        };

        runtime.block_on(poll_loop(app, &mut receiver));
    });
}

async fn poll_loop(app: AppHandle, receiver: &mut UnboundedReceiver<Command>) {
    let mut signature = String::new();
    let mut art_cache: Option<(u64, String)> = None;
    let mut last_error = String::new();
    let mut local = match crate::local_player::LocalPlayer::new().await {
        Ok(player) => Some(player),
        Err(error) => {
            logline!("local player unavailable: {error}");
            None
        }
    };
    let mut command_error: Option<String> = None;

    loop {
        let command = tokio::select! {
            _ = sleep(POLL_INTERVAL) => None,
            command = receiver.recv() => {
                if command.is_none() { break; }
                command
            }
        };
        if let Some(command) = command {
            let result = match command {
                Command::OpenFiles(paths) => match local.as_mut() {
                    Some(player) => player.open(paths).await.map_err(|error| error.to_string()),
                    None => Err("The built-in player could not start. Restart winx-island and try again.".into()),
                },
                Command::AddFiles(paths) => match local.as_mut() {
                    Some(player) => player.add(paths).await.map_err(|error| error.to_string()),
                    None => Err("The built-in player could not start. Restart winx-island and try again.".into()),
                },
                Command::UseSystem => match local.as_mut() {
                    Some(player) => player.use_system().map_err(|error| error.to_string()),
                    None => Ok(()),
                },
                Command::Refresh => Ok(()),
                Command::Transport(action) => {
                    if let Some(player) = local.as_mut().filter(|player| player.active()) {
                        player.control(&action, 0).await.map_err(|error| error.to_string())
                    } else {
                        control(&action, 0).await.map_err(|error| error.to_string())
                    }
                }
                Command::Seek(position) => {
                    if let Some(player) = local.as_mut().filter(|player| player.active()) {
                        player.control("seek", position).await.map_err(|error| error.to_string())
                    } else {
                        control("seek", position).await.map_err(|error| error.to_string())
                    }
                }
            };
            command_error = result.err();
            if let Some(error) = command_error.as_ref() {
                logline!("media command failed: {error}");
                if let Some(player) = local.as_ref().filter(|player| player.active()) {
                    player.set_error(error.clone());
                }
            }
            signature.clear();
        }

        let local_active = local.as_ref().is_some_and(|player| player.active());
        let result = if let Some(player) = local.as_mut().filter(|player| player.active()) {
            if let Err(error) = player.tick().await {
                player.set_error(error.to_string());
            }
            player.snapshot()
        } else {
            query(&mut art_cache).await
        };
        let mut snapshot = match result {
            Ok(snapshot) => snapshot,
            Err(error) => {
                let message = error.to_string();
                if message != last_error {
                    logline!("media query failed: {message}");
                    last_error = message;
                }
                MediaSnapshot::default()
            }
        };
        if command_error.is_some() {
            snapshot.playback_error = command_error.clone();
        }
        let next = snapshot.signature();
        if local_active || next != signature {
            signature = next;
            let _ = app.emit("island://media", &snapshot);
        }
    }
}

async fn manager() -> windows::core::Result<GlobalSystemMediaTransportControlsSessionManager> {
    GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await
}

async fn query(art_cache: &mut Option<(u64, String)>) -> windows::core::Result<MediaSnapshot> {
    let manager = manager().await?;
    let session = manager.GetCurrentSession()?;
    read_session(&session, art_cache).await
}

async fn read_session(
    session: &GlobalSystemMediaTransportControlsSession,
    art_cache: &mut Option<(u64, String)>,
) -> windows::core::Result<MediaSnapshot> {
    let properties = session.TryGetMediaPropertiesAsync()?.await?;
    let info = session.GetPlaybackInfo()?;
    let status = info
        .PlaybackStatus()
        .unwrap_or(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed);
    let controls = info.Controls().ok();

    let (position_ms, duration_ms) = match session.GetTimelineProperties() {
        Ok(timeline) => {
            let start = timeline
                .StartTime()
                .map(|value| value.Duration / 10_000)
                .unwrap_or(0);
            let end = timeline
                .EndTime()
                .map(|value| value.Duration / 10_000)
                .unwrap_or(0);
            let max_seek = timeline
                .MaxSeekTime()
                .map(|value| value.Duration / 10_000)
                .unwrap_or(0);
            let position = timeline
                .Position()
                .map(|value| value.Duration / 10_000)
                .unwrap_or(0);
            let duration = end.max(max_seek);
            ((position - start).max(0), (duration - start).max(0))
        }
        Err(_) => (0, 0),
    };

    let mut snapshot = MediaSnapshot {
        available: true,
        title: properties
            .Title()
            .map(|value| value.to_string())
            .unwrap_or_default(),
        artist: properties
            .Artist()
            .map(|value| value.to_string())
            .unwrap_or_default(),
        album: properties
            .AlbumTitle()
            .map(|value| value.to_string())
            .unwrap_or_default(),
        playing: status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing,
        position_ms,
        duration_ms,
        can_next: controls
            .as_ref()
            .and_then(|value| value.IsNextEnabled().ok())
            .unwrap_or(false),
        can_prev: controls
            .as_ref()
            .and_then(|value| value.IsPreviousEnabled().ok())
            .unwrap_or(false),
        can_seek: controls
            .as_ref()
            .and_then(|value| value.IsPlaybackPositionEnabled().ok())
            .unwrap_or(false),
        art: None,
        source_app: session
            .SourceAppUserModelId()
            .map(|value| value.to_string())
            .unwrap_or_default(),
        ..Default::default()
    };

    if let Ok(thumbnail) = properties.Thumbnail() {
        match read_thumbnail(&thumbnail, art_cache).await {
            Ok(art) => snapshot.art = art,
            Err(error) => logline!("thumbnail read failed: {error}"),
        }
    }

    Ok(snapshot)
}

async fn read_thumbnail(
    reference: &IRandomAccessStreamReference,
    art_cache: &mut Option<(u64, String)>,
) -> windows::core::Result<Option<String>> {
    let stream = reference.OpenReadAsync()?.await?;
    let size = stream.Size()? as u32;
    if size == 0 || size > MAX_ART_BYTES {
        return Ok(None);
    }

    let input: IInputStream = stream.cast()?;
    let reader = DataReader::CreateDataReader(&input)?;
    reader.LoadAsync(size)?.await?;

    let available = reader.UnconsumedBufferLength()? as usize;
    if available == 0 {
        return Ok(None);
    }

    let mut bytes = vec![0u8; available];
    reader.ReadBytes(&mut bytes)?;

    let hash = hash_bytes(&bytes);
    if let Some((cached_hash, cached)) = art_cache.as_ref() {
        if *cached_hash == hash {
            return Ok(Some(cached.clone()));
        }
    }

    let mime = stream
        .ContentType()
        .map(|value| value.to_string())
        .unwrap_or_else(|_| "image/jpeg".to_string());
    let data_url = format!("data:{};base64,{}", mime, STANDARD.encode(&bytes));
    *art_cache = Some((hash, data_url.clone()));

    Ok(Some(data_url))
}

fn hash_bytes(bytes: &[u8]) -> u64 {
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    hasher.finish()
}

async fn control(action: &str, position_ms: i64) -> windows::core::Result<()> {
    let manager = manager().await?;
    let session = manager.GetCurrentSession()?;

    match action {
        "play_pause" => {
            session.TryTogglePlayPauseAsync()?.await?;
        }
        "next" => {
            session.TrySkipNextAsync()?.await?;
        }
        "prev" => {
            session.TrySkipPreviousAsync()?.await?;
        }
        "seek" => {
            session
                .TryChangePlaybackPositionAsync(position_ms.saturating_mul(10_000))?
                .await?;
        }
        other => logline!("unknown media action: {other}"),
    }

    Ok(())
}
