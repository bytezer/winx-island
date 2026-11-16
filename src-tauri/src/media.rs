use crate::media_choice::{choose_source, source_label, Candidate};
use crate::media_snapshot::{MediaSnapshot, MediaSource};
use crate::system_media::SystemMedia;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio::time::{sleep, Duration};
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

const POLL_INTERVAL: Duration = Duration::from_millis(500);

pub enum Command {
    Transport(String),
    Seek(i64),
    OpenFiles(Vec<String>),
    AddFiles(Vec<String>),
    SelectSource(String),
    UseSystem,
    Refresh,
}

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
        if unsafe { RoInitialize(RO_INIT_MULTITHREADED) }.is_err() {
            return;
        }
        let Ok(runtime) = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
        else {
            return;
        };
        runtime.block_on(poll_loop(app, &mut receiver));
    });
}

async fn poll_loop(app: AppHandle, receiver: &mut UnboundedReceiver<Command>) {
    let mut local = crate::local_player::LocalPlayer::new().await.ok();
    let mut system = SystemMedia::new();
    let mut selection = "auto".to_string();
    let mut selected = String::new();
    let mut command_error = None;
    loop {
        let command = tokio::select! {
            _ = sleep(POLL_INTERVAL) => None,
            command = receiver.recv() => { if command.is_none() { break; } command }
        };
        if let Some(command) = command {
            let result = match command {
                Command::OpenFiles(paths) => {
                    selection = "local".into();
                    match local.as_mut() {
                        Some(player) => player.open(paths).await.map_err(|error| error.to_string()),
                        None => Err("El reproductor local no está disponible.".into()),
                    }
                }
                Command::AddFiles(paths) => {
                    selection = "local".into();
                    match local.as_mut() {
                        Some(player) => player.add(paths).await.map_err(|error| error.to_string()),
                        None => Err("El reproductor local no está disponible.".into()),
                    }
                }
                Command::UseSystem => {
                    select_source("system", &mut selection, &mut local, &system).await
                }
                Command::SelectSource(id) => {
                    select_source(&id, &mut selection, &mut local, &system).await
                }
                Command::Refresh => Ok(()),
                Command::Transport(action) => {
                    route_action(&selected, &action, 0, &mut local, &system).await
                }
                Command::Seek(position) => {
                    route_action(&selected, "seek", position, &mut local, &system).await
                }
            };
            command_error = result.err();
        }
        let _ = system.refresh().await;
        if let Some(player) = local.as_mut() {
            if let Err(error) = player.tick().await {
                player.set_error(error.to_string());
            }
        }
        let local_snapshot = local
            .as_ref()
            .filter(|player| player.has_tracks())
            .and_then(|player| player.snapshot().ok());
        let mut sources: Vec<MediaSource> = system
            .entries
            .iter()
            .map(|entry| MediaSource {
                id: entry.id.clone(),
                label: source_label(&entry.snapshot.source_app),
                title: entry.snapshot.title.clone(),
                playing: entry.snapshot.playing,
            })
            .collect();
        if let Some(snapshot) = local_snapshot.as_ref() {
            sources.push(MediaSource {
                id: "local".into(),
                label: "Archivos locales".into(),
                title: snapshot.title.clone(),
                playing: snapshot.playing,
            });
        }
        if selection != "auto"
            && selection != "system"
            && !sources.iter().any(|source| source.id == selection)
        {
            selection = "auto".into();
        }
        let candidates: Vec<_> = sources
            .iter()
            .filter(|source| selection != "system" || source.id != "local")
            .map(|source| Candidate {
                id: source.id.clone(),
                playing: source.playing,
            })
            .collect();
        selected =
            choose_source(&selection, &candidates, system.current.as_deref()).unwrap_or_default();
        let mut snapshot = if selected == "local" {
            if let Some(player) = local.as_mut().filter(|player| !player.active()) {
                let _ = player.select().await;
            }
            local_snapshot.unwrap_or_default()
        } else if selected.is_empty() {
            MediaSnapshot {
                can_play_pause: true,
                can_next: true,
                can_prev: true,
                repeat_mode: "off".into(),
                ..Default::default()
            }
        } else {
            system.snapshot(&selected).await.unwrap_or_default()
        };
        snapshot.source_selection = selection.clone();
        snapshot.selected_source_id = selected.clone();
        snapshot.sources = sources;
        if command_error.is_some() {
            snapshot.playback_error = command_error.clone();
        }
        let _ = app.emit("island://media", snapshot);
    }
}

async fn select_source(
    id: &str,
    selection: &mut String,
    local: &mut Option<crate::local_player::LocalPlayer>,
    system: &SystemMedia,
) -> Result<(), String> {
    if id == "local" {
        let player = local
            .as_mut()
            .filter(|player| player.has_tracks())
            .ok_or("Primero agrega música local.")?;
        player.select().await.map_err(|error| error.to_string())?;
    } else if id != "auto" {
        if id != "system" && !system.entries.iter().any(|entry| entry.id == id) {
            return Err("La fuente seleccionada ya no está disponible.".into());
        }
        if let Some(player) = local.as_mut() {
            player.use_system().map_err(|error| error.to_string())?;
        }
    }
    *selection = id.into();
    Ok(())
}

async fn route_action(
    selected: &str,
    action: &str,
    position: i64,
    local: &mut Option<crate::local_player::LocalPlayer>,
    system: &SystemMedia,
) -> Result<(), String> {
    if selected == "local" {
        local
            .as_mut()
            .ok_or("El reproductor local no está disponible.")?
            .control(action, position)
            .await
            .map_err(|error| error.to_string())
    } else if selected.is_empty() {
        crate::system_media::media_key(action)
    } else {
        system.control(selected, action, position).await
    }
}
