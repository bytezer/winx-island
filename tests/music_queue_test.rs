#[path = "../src-tauri/src/music_queue.rs"]
mod music_queue;

use music_queue::{parse_selection, MusicQueue};

#[test]
fn local_01_empty_queue_has_no_track_or_navigation() {
    let queue = MusicQueue::new(vec![], 0);
    assert_eq!(queue.current(), None);
    assert!(!queue.has_next());
    assert!(!queue.has_previous());
}

#[test]
fn local_02_queue_restores_index_and_clamps_stale_index() {
    let tracks = vec!["first.mp3".into(), "second.flac".into()];
    assert_eq!(MusicQueue::new(tracks.clone(), 1).current(), Some("second.flac"));
    assert_eq!(MusicQueue::new(tracks, 80).current(), Some("second.flac"));
}

#[test]
fn local_03_navigation_never_wraps_or_leaves_queue() {
    let mut queue = MusicQueue::new(vec!["first.mp3".into(), "second.wav".into()], 0);
    assert!(!queue.previous());
    assert!(queue.next());
    assert_eq!(queue.current(), Some("second.wav"));
    assert!(!queue.next());
    assert!(queue.previous());
    assert_eq!(queue.current(), Some("first.mp3"));
}

#[test]
fn local_04_cancelled_picker_does_not_produce_paths() {
    assert!(parse_selection(&[0; 8]).is_empty());
}

#[test]
fn local_05_single_file_preserves_unicode_and_spaces() {
    let path = "C:\\Música\\mi canción.mp3";
    let buffer: Vec<u16> = format!("{path}\0\0").encode_utf16().collect();
    assert_eq!(parse_selection(&buffer), vec![path]);
}

#[test]
fn local_06_multiselect_joins_directory_and_names() {
    let buffer: Vec<u16> = "C:\\Música\0uno.mp3\0dos.flac\0\0".encode_utf16().collect();
    assert_eq!(parse_selection(&buffer), vec!["C:\\Música\\uno.mp3", "C:\\Música\\dos.flac"]);
}

#[test]
fn mode_01_shuffle_visits_all_tracks_once_and_previous_follows_history() {
    let mut queue = MusicQueue::new((0..8).map(|i| format!("{i}.mp3")).collect(), 0);
    queue.set_shuffle(true);
    let mut visited = vec![queue.index];
    while queue.next() { visited.push(queue.index); }
    let mut unique = visited.clone();
    unique.sort();
    unique.dedup();
    assert_eq!(unique.len(), 8);
    assert_eq!(visited.len(), 8);
    assert!(queue.previous());
    assert_eq!(queue.index, visited[6]);
    assert!(queue.next());
    assert_eq!(queue.index, visited[7]);
    let current = queue.index;
    queue.set_shuffle(false);
    assert_eq!(queue.index, current);
}

#[test]
fn mode_02_repeat_one_is_automatic_and_repeat_all_wraps() {
    use music_queue::RepeatMode;
    let mut queue = MusicQueue::new(vec!["a".into(), "b".into()], 0);
    queue.repeat = RepeatMode::One;
    assert!(queue.advance(true));
    assert_eq!(queue.index, 0);
    assert!(queue.next());
    assert_eq!(queue.index, 1);
    queue.repeat = RepeatMode::All;
    assert!(queue.advance(true));
    assert_eq!(queue.index, 0);
    assert!(queue.previous());
    assert_eq!(queue.index, 1);
}

#[test]
fn mode_03_empty_single_shuffle_and_appended_tracks_are_safe() {
    use music_queue::RepeatMode;
    let mut empty = MusicQueue::default();
    empty.set_shuffle(true);
    empty.repeat = RepeatMode::All;
    assert!(!empty.advance(true));
    let mut queue = MusicQueue::new(vec!["a".into()], 0);
    queue.set_shuffle(true);
    assert!(!queue.next());
    queue.repeat = RepeatMode::All;
    assert!(queue.next());
    queue.append(vec!["b".into(), "c".into()]);
    let mut visited = vec![];
    for _ in 0..2 { assert!(queue.next()); visited.push(queue.index); }
    visited.sort();
    assert_eq!(visited, vec![1, 2]);
}

#[test]
fn mode_06_repeat_shuffle_cycles_include_every_track_without_adjacent_repeats() {
    use music_queue::RepeatMode;
    let mut queue = MusicQueue::new((0..8).map(|i| format!("{i}.mp3")).collect(), 0);
    queue.set_shuffle(true);
    for _ in 0..7 { assert!(queue.next()); }
    assert!(!queue.next());
    queue.repeat = RepeatMode::All;
    for _ in 0..20 {
        let mut visited = Vec::new();
        for _ in 0..8 {
            let previous = queue.index;
            assert!(queue.next());
            assert_ne!(queue.index, previous);
            visited.push(queue.index);
        }
        visited.sort();
        assert_eq!(visited, (0..8).collect::<Vec<_>>());
    }
}
