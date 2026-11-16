use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSource {
    pub id: String,
    pub label: String,
    pub title: String,
    pub playing: bool,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSnapshot {
    pub available: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub playing: bool,
    pub position_ms: i64,
    pub duration_ms: i64,
    pub can_next: bool,
    pub can_prev: bool,
    pub can_seek: bool,
    pub art: Option<String>,
    pub source_app: String,
    pub queue_index: usize,
    pub queue_length: usize,
    pub playback_error: Option<String>,
    pub shuffle_enabled: bool,
    pub repeat_mode: String,
    pub can_play_pause: bool,
    pub source_selection: String,
    pub selected_source_id: String,
    pub sources: Vec<MediaSource>,
}
