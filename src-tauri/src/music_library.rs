use std::collections::HashSet;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "m4a", "aac", "wma", "ogg", "opus", "aif", "aiff", "alac", "weba",
];

#[derive(Default)]
pub struct FolderScan {
    pub tracks: Vec<String>,
    pub skipped_folders: usize,
}

fn path_key(path: &Path) -> String {
    let value = path.to_string_lossy().into_owned();
    if cfg!(windows) {
        value.to_lowercase()
    } else {
        value
    }
}

fn is_audio(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return false;
    };
    let extension = extension.to_ascii_lowercase();
    if extension == "mpeg" {
        return has_mpeg_audio_header(path).unwrap_or(false);
    }
    AUDIO_EXTENSIONS.contains(&extension.as_str())
}

fn has_mpeg_audio_header(path: &Path) -> std::io::Result<bool> {
    let mut file = std::fs::File::open(path)?;
    let mut frame = [0_u8; 4];
    file.read_exact(&mut frame)?;
    if &frame[..3] == b"ID3" {
        file.seek(SeekFrom::Start(0))?;
        let mut tag = [0_u8; 10];
        file.read_exact(&mut tag)?;
        if tag[6..10].iter().any(|byte| byte & 0x80 != 0) {
            return Ok(false);
        }
        let size = tag[6..10]
            .iter()
            .fold(0_u64, |size, byte| (size << 7) | u64::from(*byte));
        file.seek(SeekFrom::Start(10 + size))?;
        file.read_exact(&mut frame)?;
        if &frame[..3] == b"3DI" {
            file.seek(SeekFrom::Current(6))?;
            file.read_exact(&mut frame)?;
        }
    }
    Ok(frame[0] == 0xff
        && frame[1] & 0xe0 == 0xe0
        && (frame[1] >> 3) & 3 != 1
        && (frame[1] >> 1) & 3 != 0
        && frame[2] >> 4 != 0
        && frame[2] >> 4 != 15
        && (frame[2] >> 2) & 3 != 3)
}

pub fn scan_folders(roots: &[PathBuf]) -> FolderScan {
    let mut scan = FolderScan::default();
    let mut pending = roots.to_vec();
    let mut visited = HashSet::new();
    let mut files = HashSet::new();

    while let Some(directory) = pending.pop() {
        match std::fs::symlink_metadata(&directory) {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
            _ => {
                scan.skipped_folders += 1;
                continue;
            }
        };
        let canonical = match directory.canonicalize() {
            Ok(path) => path,
            Err(_) => {
                scan.skipped_folders += 1;
                continue;
            }
        };
        if !visited.insert(path_key(&canonical)) {
            continue;
        }
        let entries = match std::fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => {
                scan.skipped_folders += 1;
                continue;
            }
        };
        for entry in entries {
            let Ok(entry) = entry else {
                scan.skipped_folders += 1;
                continue;
            };
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if kind.is_symlink() {
                continue;
            }
            let path = entry.path();
            if kind.is_dir() {
                pending.push(path);
            } else if kind.is_file() && is_audio(&path) {
                if let Ok(canonical) = path.canonicalize() {
                    if files.insert(path_key(&canonical)) {
                        scan.tracks.push(path.to_string_lossy().into_owned());
                    }
                }
            }
        }
    }
    scan.tracks.sort_by_cached_key(|path| path.to_lowercase());
    scan
}
