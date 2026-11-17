#[path = "../src-tauri/src/music_library.rs"]
mod music_library;
#[path = "../src-tauri/src/music_queue.rs"]
mod music_queue;

use music_library::scan_folders;
use music_queue::MusicQueue;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let root = std::env::temp_dir().join(format!(
            "winx-library-test-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&root).unwrap();
        Self(root)
    }

    fn file(&self, name: &str) -> PathBuf {
        let path = self.0.join(name);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"fixture").unwrap();
        path
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn names(paths: &[String]) -> Vec<String> {
    paths
        .iter()
        .map(|path| {
            Path::new(path)
                .file_name()
                .unwrap()
                .to_string_lossy()
                .into_owned()
        })
        .collect()
}

#[test]
fn folder_01_recurses_and_filters_non_audio_files_case_insensitively() {
    let fixture = Fixture::new();
    for name in [
        "song.MP3",
        "album/nested/track.FLAC",
        "album/voice.wav",
        "song.mp3.txt",
        "cover.jpg",
        "notes.pdf",
        "video.mp4",
        "no_extension",
    ] {
        fixture.file(name);
    }
    let scan = scan_folders(&[fixture.0.clone()]);
    assert_eq!(scan.tracks.len(), 3);
    let mut found = names(&scan.tracks);
    found.sort();
    assert_eq!(found, vec!["song.MP3", "track.FLAC", "voice.wav"]);
}

#[test]
fn folder_02_multiple_roots_and_overlapping_subfolders_do_not_duplicate() {
    let first = Fixture::new();
    let second = Fixture::new();
    first.file("album/song.mp3");
    second.file("música/canción.m4a");
    let scan = scan_folders(&[
        first.0.clone(),
        second.0.clone(),
        first.0.join("album"),
        first.0.clone(),
    ]);
    assert_eq!(scan.tracks.len(), 2);
}

#[test]
fn folder_03_empty_and_missing_folders_report_no_music_without_panicking() {
    let fixture = Fixture::new();
    fixture.file("document.txt");
    assert!(scan_folders(&[fixture.0.clone()]).tracks.is_empty());
    let missing = scan_folders(&[fixture.0.join("missing")]);
    assert!(missing.tracks.is_empty());
    assert_eq!(missing.skipped_folders, 1);
    assert!(scan_folders(&[]).tracks.is_empty());
}

#[test]
fn folder_04_scan_order_is_deterministic() {
    let fixture = Fixture::new();
    for name in ["z.mp3", "a.mp3", "nested/b.opus"] {
        fixture.file(name);
    }
    let first = scan_folders(&[fixture.0.clone()]).tracks;
    let second = scan_folders(&[fixture.0.clone()]).tracks;
    assert_eq!(first.len(), 3);
    assert_eq!(first, second);
    let mut sorted = first.clone();
    sorted.sort_by_key(|path| path.to_lowercase());
    assert_eq!(first, sorted);
}

#[cfg(unix)]
#[test]
fn folder_05_symbolic_links_do_not_escape_selected_folders_or_loop() {
    let fixture = Fixture::new();
    let outside = Fixture::new();
    fixture.file("inside.mp3");
    let secret = outside.file("outside.mp3");
    std::os::unix::fs::symlink(&fixture.0, fixture.0.join("cycle")).unwrap();
    std::os::unix::fs::symlink(&outside.0, fixture.0.join("outside")).unwrap();
    std::os::unix::fs::symlink(secret, fixture.0.join("linked.mp3")).unwrap();
    assert_eq!(
        names(&scan_folders(&[fixture.0.clone()]).tracks),
        vec!["inside.mp3"]
    );
}

#[test]
fn folder_06_adding_music_preserves_current_track_and_deduplicates_windows_paths() {
    let mut queue = MusicQueue::new(
        vec![
            "C:\\Music\\first.mp3".into(),
            "C:\\Music\\second.mp3".into(),
        ],
        1,
    );
    let count = queue.append(vec![
        "c:/music/FIRST.mp3".into(),
        "C:\\Music\\new.flac".into(),
        "C:\\Music\\new.flac".into(),
    ]);
    assert_eq!(count, 1);
    assert_eq!(queue.index, 1);
    assert_eq!(queue.current(), Some("C:\\Music\\second.mp3"));
    assert_eq!(queue.tracks.len(), 3);
}

#[test]
fn folder_07_empty_queue_accepts_import_and_empty_import_is_a_noop() {
    let mut queue = MusicQueue::default();
    assert_eq!(queue.append(vec!["song.mp3".into()]), 1);
    assert_eq!(queue.current(), Some("song.mp3"));
    assert_eq!(queue.append(vec![]), 0);
    assert_eq!(queue.current(), Some("song.mp3"));
}

#[test]
fn folder_12_mpeg_extension_accepts_mp3_frames_and_id3_tags_but_not_video_or_documents() {
    let fixture = Fixture::new();
    let raw = fixture.file("audio.mpeg");
    std::fs::write(raw, [0xff, 0xfb, 0x94, 0x00, 0x00, 0x00]).unwrap();
    let tagged = fixture.file("tagged.MPEG");
    std::fs::write(
        tagged,
        [
            b'I', b'D', b'3', 4, 0, 0, 0, 0, 0, 3, 1, 2, 3, 0xff, 0xfb, 0x94, 0,
        ],
    )
    .unwrap();
    let video = fixture.file("video.mpeg");
    std::fs::write(video, [0x00, 0x00, 0x01, 0xba, 0x44, 0x00]).unwrap();
    fixture.file("document.mpeg");
    let mut found = names(&scan_folders(&[fixture.0.clone()]).tracks);
    found.sort();
    assert_eq!(found, vec!["audio.mpeg", "tagged.MPEG"]);
}

#[test]
fn folder_13_invalid_mpeg_headers_and_truncated_tags_are_ignored() {
    let fixture = Fixture::new();
    for (name, bytes) in [
        ("truncated.mpeg", vec![b'I', b'D', b'3']),
        ("invalid.mpeg", vec![0xff, 0xff, 0xff, 0xff]),
        (
            "too_long.mpeg",
            vec![b'I', b'D', b'3', 4, 0, 0, 0x7f, 0x7f, 0x7f, 0x7f],
        ),
    ] {
        std::fs::write(fixture.file(name), bytes).unwrap();
    }
    assert!(scan_folders(&[fixture.0.clone()]).tracks.is_empty());
}
