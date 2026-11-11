use serde::Serialize;

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
}

impl MediaSnapshot {
    pub fn signature(&self) -> String {
        format!(
            "{}|{}|{}|{}|{}|{}|{}|{}|{}",
            self.available,
            self.playing,
            self.title,
            self.artist,
            self.album,
            self.duration_ms,
            self.source_app,
            self.can_next,
            self.art.as_ref().map_or(0, |art| art.len())
        )
    }
}
