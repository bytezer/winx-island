#[path = "../src-tauri/src/media_choice.rs"]
mod media_choice;
use media_choice::{choose_source, Candidate};

fn source(id: &str, playing: bool) -> Candidate { Candidate { id: id.into(), playing } }

#[test]
fn media_01_playing_external_session_beats_paused_current_and_saved_local() {
    let sources = vec![source("local", false), source("edge", false), source("spotify", true)];
    assert_eq!(choose_source("auto", &sources, Some("edge")), Some("spotify".into()));
}
#[test]
fn media_02_pin_stays_on_selected_session_and_disconnection_returns_to_auto() {
    let sources = vec![source("edge-tab-1", false), source("edge-tab-2", true)];
    assert_eq!(choose_source("edge-tab-1", &sources, Some("edge-tab-2")), Some("edge-tab-1".into()));
    assert_eq!(choose_source("closed", &sources, Some("edge-tab-1")), Some("edge-tab-2".into()));
}
#[test]
fn media_03_local_playback_and_empty_system_are_valid_auto_fallbacks() {
    assert_eq!(choose_source("auto", &[source("local", true), source("edge", false)], Some("edge")), Some("local".into()));
    assert_eq!(choose_source("auto", &[], None), None);
    assert_eq!(choose_source("auto", &[source("local", false)], None), Some("local".into()));
}

#[test]
fn media_04_timeline_uses_update_time_and_respects_pause_start_and_duration() {
    use media_choice::timeline_position;
    assert_eq!(timeline_position(15_000, 5_000, 30_000, true, 1_000, 4_000), 13_000);
    assert_eq!(timeline_position(15_000, 5_000, 30_000, false, 1_000, 4_000), 10_000);
    assert_eq!(timeline_position(29_000, 0, 30_000, true, 1_000, 4_000), 30_000);
    assert_eq!(timeline_position(5_000, 0, 30_000, true, 0, 4_000), 5_000);
}
