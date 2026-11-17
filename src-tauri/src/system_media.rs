use crate::media_snapshot::MediaSnapshot;
use base64::{engine::general_purpose::STANDARD, Engine};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use windows::core::Interface;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
use windows::Storage::Streams::{DataReader, IInputStream, IRandomAccessStreamReference};

pub struct Entry {
    pub id: String,
    pub session: Session,
    pub snapshot: MediaSnapshot,
}

pub struct SystemMedia {
    manager: Option<Manager>,
    pub entries: Vec<Entry>,
    pub current: Option<String>,
    sequence: u64,
    art_cache: Option<(u64, String)>,
}

impl SystemMedia {
    pub fn new() -> Self {
        Self {
            manager: None,
            entries: Vec::new(),
            current: None,
            sequence: 0,
            art_cache: None,
        }
    }

    pub async fn refresh(&mut self) -> windows::core::Result<()> {
        if self.manager.is_none() {
            self.manager = Some(Manager::RequestAsync()?.await?);
        }
        let manager = self.manager.as_ref().unwrap();
        let sessions = match manager.GetSessions() {
            Ok(sessions) => sessions,
            Err(error) => {
                self.manager = None;
                self.entries.clear();
                self.current = None;
                return Err(error);
            }
        };
        let current = manager.GetCurrentSession().ok();
        let previous = std::mem::take(&mut self.entries);
        self.current = None;
        for index in 0..sessions.Size()? {
            let Ok(session) = sessions.GetAt(index) else {
                continue;
            };
            let Ok(snapshot) = read_session(&session).await else {
                continue;
            };
            let id = if let Some(old) = previous.iter().find(|old| old.session == session) {
                old.id.clone()
            } else {
                self.sequence += 1;
                format!("system:{}", self.sequence)
            };
            if current.as_ref() == Some(&session) {
                self.current = Some(id.clone());
            }
            self.entries.push(Entry {
                id,
                session,
                snapshot,
            });
        }
        Ok(())
    }

    pub async fn snapshot(&mut self, id: &str) -> windows::core::Result<MediaSnapshot> {
        let entry = self
            .entries
            .iter()
            .find(|entry| entry.id == id)
            .ok_or_else(|| {
                windows::core::Error::new(
                    windows::core::HRESULT(0x80070490u32 as i32),
                    "error.source_unavailable",
                )
            })?;
        let mut snapshot = entry.snapshot.clone();
        if let Ok(request) = entry.session.TryGetMediaPropertiesAsync() {
            if let Ok(properties) = request.await {
                if let Ok(thumbnail) = properties.Thumbnail() {
                    if let Ok(art) = read_thumbnail(&thumbnail, &mut self.art_cache).await {
                        snapshot.art = art;
                    }
                }
            }
        }
        Ok(snapshot)
    }

    pub async fn control(&self, id: &str, action: &str, position_ms: i64) -> Result<(), String> {
        let entry = self
            .entries
            .iter()
            .find(|entry| entry.id == id)
            .ok_or("error.source_closed")?;
        control_session(&entry.session, action, position_ms, entry.snapshot.playing)
            .await
            .map_err(|error| error.to_string())
    }
}

async fn read_session(session: &Session) -> windows::core::Result<MediaSnapshot> {
    let info = session.GetPlaybackInfo()?;
    let playing = info.PlaybackStatus().unwrap_or(Status::Closed) == Status::Playing;
    let controls = info.Controls().ok();
    let properties = match session.TryGetMediaPropertiesAsync() {
        Ok(request) => request.await.ok(),
        Err(_) => None,
    };
    let source = session
        .SourceAppUserModelId()
        .map(|value| value.to_string())
        .unwrap_or_default();
    let mut snapshot = MediaSnapshot {
        available: true,
        playing,
        source_app: source,
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
        can_play_pause: controls.as_ref().is_some_and(|value| {
            value.IsPlayPauseToggleEnabled().unwrap_or(false)
                || if playing {
                    value.IsPauseEnabled().unwrap_or(false)
                } else {
                    value.IsPlayEnabled().unwrap_or(false)
                }
        }),
        repeat_mode: "off".into(),
        ..Default::default()
    };
    if let Some(properties) = properties {
        snapshot.title = properties
            .Title()
            .map(|value| value.to_string())
            .unwrap_or_default();
        snapshot.artist = properties
            .Artist()
            .map(|value| value.to_string())
            .unwrap_or_default();
        snapshot.album = properties
            .AlbumTitle()
            .map(|value| value.to_string())
            .unwrap_or_default();
    }
    if snapshot.artist.is_empty() {
        snapshot.artist = crate::media_choice::source_label(&snapshot.source_app);
    }
    if let Ok(timeline) = session.GetTimelineProperties() {
        let start = timeline
            .StartTime()
            .map(|value| value.Duration / 10_000)
            .unwrap_or(0);
        let end = timeline
            .EndTime()
            .map(|value| value.Duration / 10_000)
            .unwrap_or(0)
            .max(
                timeline
                    .MaxSeekTime()
                    .map(|value| value.Duration / 10_000)
                    .unwrap_or(0),
            );
        snapshot.duration_ms = (end - start).max(0);
        let position = timeline
            .Position()
            .map(|value| value.Duration / 10_000)
            .unwrap_or(start);
        let updated = timeline
            .LastUpdatedTime()
            .map(|value| value.UniversalTime.saturating_sub(116_444_736_000_000_000) / 10_000)
            .unwrap_or(0);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        snapshot.position_ms = crate::media_choice::timeline_position(
            position,
            start,
            snapshot.duration_ms,
            playing,
            updated,
            now,
        );
    }
    Ok(snapshot)
}

async fn control_session(
    session: &Session,
    action: &str,
    position_ms: i64,
    playing: bool,
) -> windows::core::Result<()> {
    let accepted = match action {
        "play_pause" => {
            if session
                .GetPlaybackInfo()?
                .Controls()?
                .IsPlayPauseToggleEnabled()?
            {
                session.TryTogglePlayPauseAsync()?.await?
            } else if playing {
                session.TryPauseAsync()?.await?
            } else {
                session.TryPlayAsync()?.await?
            }
        }
        "next" => session.TrySkipNextAsync()?.await?,
        "prev" => session.TrySkipPreviousAsync()?.await?,
        "seek" => {
            let start = session.GetTimelineProperties()?.StartTime()?.Duration;
            session
                .TryChangePlaybackPositionAsync(
                    start.saturating_add(position_ms.max(0).saturating_mul(10_000)),
                )?
                .await?
        }
        _ => false,
    };
    if accepted {
        Ok(())
    } else {
        Err(windows::core::Error::new(
            windows::core::HRESULT(0x80004001u32 as i32),
            "error.no_session",
        ))
    }
}

pub fn media_key(action: &str) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
        VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK,
    };
    let key = match action {
        "play_pause" => VK_MEDIA_PLAY_PAUSE,
        "next" => VK_MEDIA_NEXT_TRACK,
        "prev" => VK_MEDIA_PREV_TRACK,
        _ => return Err("error.no_session".into()),
    };
    let down = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                ..Default::default()
            },
        },
    };
    let up = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                dwFlags: KEYEVENTF_KEYUP,
                ..Default::default()
            },
        },
    };
    if unsafe { SendInput(&[down, up], std::mem::size_of::<INPUT>() as i32) } == 2 {
        Ok(())
    } else {
        Err("error.media_key_failed".into())
    }
}

async fn read_thumbnail(
    reference: &IRandomAccessStreamReference,
    cache: &mut Option<(u64, String)>,
) -> windows::core::Result<Option<String>> {
    let stream = reference.OpenReadAsync()?.await?;
    if stream.Size()? > 8 * 1024 * 1024 {
        return Ok(None);
    }
    let input: IInputStream = stream.cast()?;
    let reader = DataReader::CreateDataReader(&input)?;
    reader.LoadAsync(stream.Size()? as u32)?.await?;
    let mut bytes = vec![0; reader.UnconsumedBufferLength()? as usize];
    if bytes.is_empty() {
        return Ok(None);
    }
    reader.ReadBytes(&mut bytes)?;
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    let hash = hasher.finish();
    if let Some((_, art)) = cache.as_ref().filter(|(old_hash, _)| *old_hash == hash) {
        return Ok(Some(art.clone()));
    }
    let mime = stream
        .ContentType()
        .map(|value| value.to_string())
        .unwrap_or_else(|_| "image/jpeg".into());
    let art = format!("data:{mime};base64,{}", STANDARD.encode(bytes));
    *cache = Some((hash, art.clone()));
    Ok(Some(art))
}
