use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use windows::core::HSTRING;
use windows::Foundation::{TimeSpan, TypedEventHandler};
use windows::Media::Core::MediaSource;
use windows::Media::Playback::{MediaPlaybackState, MediaPlayer, MediaPlayerFailedEventArgs};
use windows::Storage::StorageFile;

use crate::media_snapshot::MediaSnapshot;
use crate::music_queue::{MusicQueue, RepeatMode};

#[derive(Default, Deserialize, Serialize)]
struct SavedQueue {
    tracks: Vec<String>,
    index: usize,
    use_local: bool,
    #[serde(default)]
    shuffle: bool,
    #[serde(default)]
    repeat: String,
}

pub struct LocalPlayer {
    player: MediaPlayer,
    queue: MusicQueue,
    use_local: bool,
    loaded: bool,
    finished: bool,
    ended: Arc<AtomicBool>,
    failure: Arc<Mutex<Option<String>>>,
    title: String,
    artist: String,
    album: String,
}

impl LocalPlayer {
    pub async fn new() -> windows::core::Result<Self> {
        let player = MediaPlayer::new()?;
        player.SetAutoPlay(false)?;
        player.CommandManager()?.SetIsEnabled(false)?;
        player.SystemMediaTransportControls()?.SetIsEnabled(false)?;
        let ended = Arc::new(AtomicBool::new(false));
        let end_signal = ended.clone();
        player.MediaEnded(&TypedEventHandler::new(move |_, _| {
            end_signal.store(true, Ordering::Release);
            Ok(())
        }))?;
        let failure = Arc::new(Mutex::new(None));
        let failure_signal = failure.clone();
        player.MediaFailed(
            &TypedEventHandler::<MediaPlayer, MediaPlayerFailedEventArgs>::new(move |_, args| {
                let message = args
                    .as_ref()
                    .and_then(|args| args.ErrorMessage().ok())
                    .map(|message| message.to_string())
                    .filter(|message| !message.is_empty())
                    .unwrap_or_else(|| {
                        "This audio file could not be played. Try another file.".into()
                    });
                *failure_signal.lock().unwrap() = Some(message);
                Ok(())
            }),
        )?;
        let path = crate::settings::data_dir().join("local-player.json");
        let saved: SavedQueue = std::fs::read(path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        let mut local = Self {
            player,
            queue: MusicQueue::new(saved.tracks, saved.index),
            use_local: saved.use_local,
            loaded: false,
            finished: false,
            ended,
            failure,
            title: String::new(),
            artist: String::new(),
            album: String::new(),
        };
        local.queue.repeat = RepeatMode::parse(&saved.repeat);
        local.queue.set_shuffle(saved.shuffle);
        if local.active() {
            if let Err(error) = local.load(false).await {
                local.set_error(error.to_string());
            }
        }
        Ok(local)
    }

    pub fn active(&self) -> bool {
        self.use_local && self.queue.current().is_some()
    }

    pub async fn open(&mut self, paths: Vec<String>) -> windows::core::Result<()> {
        if paths.is_empty() {
            return Ok(());
        }
        self.player.Pause()?;
        let repeat = self.queue.repeat;
        let shuffle = self.queue.shuffle;
        self.queue = MusicQueue::new(paths, 0);
        self.queue.repeat = repeat;
        self.queue.set_shuffle(shuffle);
        self.use_local = true;
        self.loaded = false;
        self.save();
        self.load(true).await
    }

    pub async fn add(&mut self, paths: Vec<String>) -> windows::core::Result<()> {
        if paths.is_empty() {
            return Ok(());
        }
        let was_active = self.active();
        let added = self.queue.append(paths);
        if added == 0 && was_active {
            return Ok(());
        }
        self.use_local = true;
        self.save();
        if !was_active {
            self.load(true).await?;
        }
        Ok(())
    }

    pub fn use_system(&mut self) -> windows::core::Result<()> {
        self.player.Pause()?;
        self.use_local = false;
        self.save();
        Ok(())
    }

    pub async fn control(&mut self, action: &str, position_ms: i64) -> windows::core::Result<()> {
        match action {
            "shuffle" => {
                self.queue.set_shuffle(!self.queue.shuffle);
                self.save();
            }
            "repeat" => {
                self.queue.repeat = self.queue.repeat.cycle();
                self.save();
            }
            "play_pause" => {
                if !self.loaded {
                    return self.load(true).await;
                }
                let session = self.player.PlaybackSession()?;
                if session.PlaybackState()? == MediaPlaybackState::Playing {
                    self.player.Pause()?;
                } else {
                    if self.finished {
                        session.SetPosition(TimeSpan { Duration: 0 })?;
                        self.finished = false;
                    }
                    self.set_error(String::new());
                    self.player.Play()?;
                }
            }
            "next" | "prev" => {
                let moved = if action == "next" {
                    self.queue.next()
                } else {
                    self.queue.previous()
                };
                if moved {
                    self.save();
                    self.load(true).await?;
                }
            }
            "seek" if self.loaded => {
                let session = self.player.PlaybackSession()?;
                let duration = session.NaturalDuration()?.Duration.max(0) / 10_000;
                session.SetPosition(TimeSpan {
                    Duration: position_ms.clamp(0, duration) * 10_000,
                })?;
                self.finished = false;
            }
            _ => {}
        }
        Ok(())
    }

    pub async fn tick(&mut self) -> windows::core::Result<()> {
        if self.active() && self.ended.swap(false, Ordering::AcqRel) {
            self.finished = true;
            if self.queue.advance(true) {
                self.save();
                self.load(true).await?;
            }
        }
        Ok(())
    }

    pub fn set_error(&self, message: String) {
        *self.failure.lock().unwrap() = if message.is_empty() {
            None
        } else {
            Some(message)
        };
    }

    pub fn snapshot(&self) -> windows::core::Result<MediaSnapshot> {
        let session = self.player.PlaybackSession()?;
        let duration = if self.loaded {
            session.NaturalDuration()?.Duration.max(0) / 10_000
        } else {
            0
        };
        let position = if self.loaded {
            session.Position()?.Duration.max(0) / 10_000
        } else {
            0
        };
        let error = self.failure.lock().unwrap().clone();
        Ok(MediaSnapshot {
            available: true,
            title: self.title.clone(),
            artist: self.artist.clone(),
            album: self.album.clone(),
            playing: error.is_none() && session.PlaybackState()? == MediaPlaybackState::Playing,
            position_ms: position,
            duration_ms: duration,
            can_next: self.queue.has_next(),
            can_prev: self.queue.has_previous(),
            can_seek: self.loaded && duration > 0,
            art: None,
            source_app: "winx-island.local".into(),
            queue_index: self.queue.index,
            queue_length: self.queue.tracks.len(),
            playback_error: error,
            shuffle_enabled: self.queue.shuffle,
            repeat_mode: self.queue.repeat.as_str().into(),
        })
    }

    async fn load(&mut self, autoplay: bool) -> windows::core::Result<()> {
        self.player.Pause()?;
        self.loaded = false;
        self.finished = false;
        self.ended.store(false, Ordering::Release);
        self.set_error(String::new());
        let path = self.queue.current().unwrap_or_default().to_string();
        self.title = Path::new(&path)
            .file_stem()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        self.artist = "Local files".into();
        self.album.clear();
        let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(&path))?.await?;
        let source = MediaSource::CreateFromStorageFile(&file)?;
        self.player.SetSource(&source)?;
        self.loaded = true;
        if autoplay {
            self.player.Play()?;
        }
        if let Ok(properties) = file.Properties() {
            if let Ok(operation) = properties.GetMusicPropertiesAsync() {
                if let Ok(tags) = operation.await {
                    if let Ok(title) = tags.Title() {
                        if !title.is_empty() {
                            self.title = title.to_string();
                        }
                    }
                    if let Ok(artist) = tags.Artist() {
                        if !artist.is_empty() {
                            self.artist = artist.to_string();
                        }
                    }
                    self.album = tags
                        .Album()
                        .map(|album| album.to_string())
                        .unwrap_or_default();
                }
            }
        }
        Ok(())
    }

    fn save(&self) {
        let saved = SavedQueue {
            tracks: self.queue.tracks.clone(),
            index: self.queue.index,
            use_local: self.use_local,
            shuffle: self.queue.shuffle,
            repeat: self.queue.repeat.as_str().into(),
        };
        let directory = crate::settings::data_dir();
        let result = (|| -> Result<(), Box<dyn std::error::Error>> {
            std::fs::create_dir_all(&directory)?;
            let temporary = directory.join("local-player.json.tmp");
            std::fs::write(&temporary, serde_json::to_vec(&saved)?)?;
            std::fs::rename(temporary, directory.join("local-player.json"))?;
            Ok(())
        })();
        if let Err(error) = result {
            crate::logger::log(format!("local playlist save failed: {error}"));
        }
    }
}
