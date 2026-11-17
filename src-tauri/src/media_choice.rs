pub struct Candidate {
    pub id: String,
    pub playing: bool,
}

pub fn choose_source(
    selection: &str,
    sources: &[Candidate],
    current: Option<&str>,
) -> Option<String> {
    if selection != "auto" && sources.iter().any(|source| source.id == selection) {
        return Some(selection.into());
    }
    let current_source = current.and_then(|id| sources.iter().find(|source| source.id == id));
    current_source
        .filter(|source| source.playing && source.id != "local")
        .or_else(|| {
            sources
                .iter()
                .find(|source| source.playing && source.id != "local")
        })
        .or_else(|| {
            sources
                .iter()
                .find(|source| source.playing && source.id == "local")
        })
        .or(current_source)
        .or_else(|| sources.iter().find(|source| source.id != "local"))
        .or_else(|| sources.first())
        .map(|source| source.id.clone())
}

pub fn source_label(source: &str) -> String {
    let lower = source.to_lowercase();
    for (pattern, label) in [
        ("spotify", "Spotify"),
        ("msedge", "Edge"),
        ("chrome", "Chrome"),
        ("firefox", "Firefox"),
        ("brave", "Brave"),
        ("opera", "Opera"),
        ("vlc", "VLC"),
    ] {
        if lower.contains(pattern) {
            return label.into();
        }
    }
    source
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(source)
        .trim_end_matches(".exe")
        .to_string()
}

pub fn timeline_position(
    position: i64,
    start: i64,
    duration: i64,
    playing: bool,
    updated_ms: i64,
    now_ms: i64,
) -> i64 {
    let elapsed = if playing && updated_ms > 0 {
        now_ms.saturating_sub(updated_ms).max(0)
    } else {
        0
    };
    let value = position
        .saturating_sub(start)
        .max(0)
        .saturating_add(elapsed);
    if duration > 0 {
        value.min(duration)
    } else {
        value
    }
}
