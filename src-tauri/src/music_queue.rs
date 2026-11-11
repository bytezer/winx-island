use std::hash::{BuildHasher, Hasher};

#[derive(Clone, Copy, Default, PartialEq)]
pub enum RepeatMode {
    #[default]
    Off,
    All,
    One,
}

impl RepeatMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::All => "all",
            Self::One => "one",
        }
    }

    pub fn parse(value: &str) -> Self {
        match value {
            "all" => Self::All,
            "one" => Self::One,
            _ => Self::Off,
        }
    }

    pub fn cycle(self) -> Self {
        match self {
            Self::Off => Self::All,
            Self::All => Self::One,
            Self::One => Self::Off,
        }
    }
}

#[derive(Default)]
pub struct MusicQueue {
    pub tracks: Vec<String>,
    pub index: usize,
    pub repeat: RepeatMode,
    pub shuffle: bool,
    upcoming: Vec<usize>,
    history: Vec<usize>,
}

impl MusicQueue {
    pub fn new(tracks: Vec<String>, index: usize) -> Self {
        let index = index.min(tracks.len().saturating_sub(1));
        Self {
            tracks,
            index,
            ..Self::default()
        }
    }

    pub fn append(&mut self, tracks: Vec<String>) -> usize {
        let mut known: std::collections::HashSet<String> = self
            .tracks
            .iter()
            .map(|path| path.replace('/', "\\").to_lowercase())
            .collect();
        let before = self.tracks.len();
        for path in tracks {
            if known.insert(path.replace('/', "\\").to_lowercase()) {
                self.tracks.push(path);
            }
        }
        if self.shuffle {
            self.upcoming.extend(before..self.tracks.len());
            self.shuffle_upcoming();
        }
        self.tracks.len() - before
    }

    pub fn current(&self) -> Option<&str> {
        self.tracks.get(self.index).map(String::as_str)
    }

    pub fn set_shuffle(&mut self, enabled: bool) {
        if self.shuffle == enabled {
            return;
        }
        self.shuffle = enabled;
        self.history.clear();
        self.upcoming.clear();
        if enabled {
            self.refill_shuffle(false);
        }
    }

    fn refill_shuffle(&mut self, include_current: bool) {
        self.upcoming = (0..self.tracks.len())
            .filter(|index| include_current || *index != self.index)
            .collect();
        self.shuffle_upcoming();
        let last = self.upcoming.len().saturating_sub(1);
        if self.upcoming.len() > 1 && self.upcoming[last] == self.index {
            self.upcoming.swap(0, last);
        }
    }

    fn shuffle_upcoming(&mut self) {
        let mut random = std::collections::hash_map::RandomState::new()
            .build_hasher()
            .finish()
            | 1;
        for end in (1..self.upcoming.len()).rev() {
            random ^= random << 13;
            random ^= random >> 7;
            random ^= random << 17;
            self.upcoming
                .swap(end, (random % (end as u64 + 1)) as usize);
        }
    }

    pub fn has_next(&self) -> bool {
        self.current().is_some()
            && (self.repeat == RepeatMode::All
                || if self.shuffle {
                    !self.upcoming.is_empty()
                } else {
                    self.index + 1 < self.tracks.len()
                })
    }

    pub fn has_previous(&self) -> bool {
        self.current().is_some()
            && if self.shuffle {
                !self.history.is_empty()
            } else {
                self.index > 0 || self.repeat == RepeatMode::All
            }
    }

    pub fn next(&mut self) -> bool {
        self.advance(false)
    }

    pub fn advance(&mut self, automatic: bool) -> bool {
        if self.current().is_none() {
            return false;
        }
        if automatic && self.repeat == RepeatMode::One {
            return true;
        }
        if !self.has_next() {
            return false;
        }
        if self.shuffle {
            if self.upcoming.is_empty() {
                self.refill_shuffle(true);
            }
            if let Some(next) = self.upcoming.pop() {
                self.history.push(self.index);
                if self.history.len() > self.tracks.len() {
                    self.history.remove(0);
                }
                self.index = next;
            }
        } else {
            self.index = (self.index + 1) % self.tracks.len();
        }
        true
    }

    pub fn previous(&mut self) -> bool {
        if !self.has_previous() {
            return false;
        }
        if self.shuffle {
            self.upcoming.push(self.index);
            self.index = self.history.pop().unwrap();
        } else {
            self.index = if self.index == 0 {
                self.tracks.len() - 1
            } else {
                self.index - 1
            };
        }
        true
    }
}

pub fn parse_selection(buffer: &[u16]) -> Vec<String> {
    let parts: Vec<String> = buffer
        .split(|value| *value == 0)
        .take_while(|part| !part.is_empty())
        .map(String::from_utf16_lossy)
        .collect();
    match parts.as_slice() {
        [] => vec![],
        [path] => vec![path.clone()],
        [directory, names @ ..] => names
            .iter()
            .map(|name| format!("{}\\{name}", directory.trim_end_matches('\\')))
            .collect(),
    }
}
