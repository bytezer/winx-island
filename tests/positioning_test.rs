#[path = "../src-tauri/src/positioning.rs"]
mod positioning;
use positioning::{anchor_from_offsets, clamp_origin, nearest_monitor, offsets_from_origin, origin_for_anchor, Bounds, Point, Screen};

fn primary() -> Screen { Screen { x: 0.0, y: 0.0, width: 1920.0, height: 1080.0, scale: 1.25 } }
fn compact() -> Bounds { Bounds { x: 214.0, y: 10.0, w: 132.0, h: 40.0 } }

#[test]
fn move_01_visible_pill_can_reach_every_edge_without_clamping_transparent_canvas() {
    let screen = primary();
    for requested in [Point { x: -5000.0, y: -5000.0 }, Point { x: 5000.0, y: 5000.0 }] {
        let origin = clamp_origin(requested, compact(), screen.scale, screen);
        let left = origin.x + compact().x * screen.scale;
        let top = origin.y + compact().y * screen.scale;
        assert!(left >= 0.0 && left + compact().w * screen.scale <= screen.width);
        assert!(top >= 0.0 && top + compact().h * screen.scale <= screen.height);
        assert!(left == 0.0 || left + compact().w * screen.scale == screen.width);
        assert!(top == 0.0 || top + compact().h * screen.scale == screen.height);
    }
}

#[test]
fn move_02_negative_monitor_and_dpi_round_trip_keep_anchor() {
    let secondary = Screen { x: -2560.0, y: -200.0, width: 2560.0, height: 1440.0, scale: 1.5 };
    let anchor = Point { x: -2000.0, y: 700.0 };
    let origin = origin_for_anchor(anchor, compact(), secondary);
    let offsets = offsets_from_origin(origin, secondary.scale, primary());
    let restored = anchor_from_offsets(primary(), offsets.0, offsets.1);
    assert!((restored.x - anchor.x).abs() <= 1.0);
    assert!((restored.y - anchor.y).abs() <= 1.0);
    assert_eq!(nearest_monitor(anchor, &[primary(), secondary]), Some(1));
}

#[test]
fn move_03_expansion_clamps_visible_controls_and_collapse_restores_anchor() {
    let anchor = Point { x: 50.0, y: 1000.0 };
    let panel = Bounds { x: 49.0, y: 10.0, w: 462.0, h: 352.0 };
    let small = origin_for_anchor(anchor, compact(), primary());
    let expanded = origin_for_anchor(anchor, panel, primary());
    assert!(expanded.x + panel.x * 1.25 >= 0.0);
    assert!(expanded.y + (panel.y + panel.h) * 1.25 <= 1080.0);
    assert_ne!(small.y, expanded.y);
    assert_eq!(small, origin_for_anchor(anchor, compact(), primary()));
    assert_eq!(nearest_monitor(Point { x: -4000.0, y: 100.0 }, &[primary()]), Some(0));
}

#[test]
fn move_04_restoring_at_top_edge_does_not_choose_the_monitor_above() {
    let above = Screen { x: 0.0, y: -1080.0, ..primary() };
    let anchor = Point { x: 960.0, y: -12.5 };
    assert_eq!(positioning::monitor_for_anchor(anchor, &[primary(), above]), Some(0));
}
