#[path = "../src/logger.rs"]
mod logger;
#[path = "../src/settings.rs"]
mod settings;
#[path = "../src/theme.rs"]
mod theme;

mod shortcuts {
    pub fn default_entries() -> Vec<crate::settings::ShortcutEntry> {
        vec![]
    }
    pub fn is_missing(_entry: &crate::settings::ShortcutEntry) -> bool {
        false
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::env::temp_dir().join(format!("winx-theme-check-{}", std::process::id()));
    std::env::set_var("APPDATA", &root);
    let directory = settings::data_dir();
    std::fs::create_dir_all(&directory)?;
    let path = directory.join("settings.yaml");
    let legacy = "appearance:\n  compactWidth: 150\n  compactHeight: 42\n  offsetX: 24\n  offsetY: 16\nvisualizer:\n  enabled: false\nshortcuts:\n  - id: personal\n    kind: folder\n    label: Personal\n    path: C:\\\\Music\nui:\n  lastPanelTab: shortcuts\n";
    std::fs::write(&path, legacy)?;
    let loaded = settings::Settings::load();
    assert_eq!(loaded.view().theme, theme::ThemeSettings::default());
    assert_eq!(std::fs::read_to_string(&path)?, legacy);
    assert_eq!(loaded.appearance().compact_width, 150);
    println!(
        "THEME-NATIVE-01 OK: legacy settings load with the existing look and no disk mutation"
    );

    let requested = theme::ThemeSettings {
        island_roundness: 0,
        bar_roundness: 0,
        color_mode: "solid".into(),
        solid_color: "#FF6600".into(),
        glow: false,
        ..Default::default()
    };
    let saved = loaded.set_theme(requested)?;
    assert_eq!(saved.solid_color, "#ff6600");
    let restored = settings::Settings::load();
    assert_eq!(restored.view().theme, saved);
    assert_eq!(restored.appearance().offset_x, 24);
    assert_eq!(restored.view().shortcuts[0].id, "personal");
    assert!(!restored.visualizer_enabled());
    assert_eq!(restored.view().last_panel_tab, "shortcuts");
    println!("THEME-NATIVE-02 OK: square/solid settings persist without changing position, shortcuts or playback preferences");

    let before = std::fs::read(&path)?;
    let invalid = theme::ThemeSettings {
        solid_color: "url(evil)".into(),
        ..saved.clone()
    };
    assert!(loaded.set_theme(invalid).is_err());
    assert_eq!(std::fs::read(&path)?, before);
    assert_eq!(loaded.view().theme, saved);
    let invalid_mode = theme::ThemeSettings {
        color_mode: "unknown".into(),
        ..saved.clone()
    };
    assert!(loaded.set_theme(invalid_mode).is_err());
    println!("THEME-NATIVE-03 OK: invalid colors and modes do not change saved or live settings");

    let backup = directory.join("settings.saved");
    std::fs::rename(&path, &backup)?;
    std::fs::create_dir(&path)?;
    let changed = theme::ThemeSettings {
        island_roundness: 55,
        ..saved.clone()
    };
    assert!(loaded.set_theme(changed).is_err());
    assert_eq!(loaded.view().theme, saved);
    assert_eq!(std::fs::read(&backup)?, before);
    std::fs::remove_dir(&path)?;
    std::fs::rename(&backup, &path)?;
    println!("THEME-NATIVE-04 OK: disk errors preserve the old theme and return a save failure");

    let concurrent = loaded.clone();
    let thread = std::thread::spawn(move || {
        for index in 0..10 {
            concurrent.set_offset(index, index);
        }
    });
    for index in 0..10 {
        loaded.set_theme(theme::ThemeSettings {
            island_roundness: index * 10,
            ..saved.clone()
        })?;
    }
    thread.join().unwrap();
    let disk = settings::Settings::load();
    assert_eq!(disk.view().theme, loaded.view().theme);
    assert_eq!(disk.appearance().offset_x, loaded.appearance().offset_x);
    println!("THEME-NATIVE-05 OK: concurrent position and theme changes preserve a consistent settings file");

    let normalized = theme::ThemeSettings {
        island_roundness: -30,
        bar_roundness: 200,
        color_mode: "obsolete".into(),
        background_color: "bad".into(),
        ..Default::default()
    }
    .normalized();
    assert_eq!(normalized.island_roundness, 0);
    assert_eq!(normalized.bar_roundness, 100);
    assert_eq!(normalized.color_mode, "rgb");
    assert_eq!(
        normalized.background_color,
        theme::ThemeSettings::default().background_color
    );
    println!("THEME-NATIVE-06 OK: stale theme values normalize safely");
    for style in ["smooth", "segmented", "dots"] {
        let requested = theme::ThemeSettings {
            bar_style: style.into(),
            gradient_direction: "vertical".into(),
            peak_enabled: true,
            peak_hold_ms: 400,
            peak_gravity: 250,
            ..loaded.view().theme
        };
        let saved = loaded.set_theme(requested)?;
        assert_eq!(settings::Settings::load().view().theme, saved);
    }
    println!(
        "THEME-NATIVE-07 OK: bar styles, vertical gradients and peak settings persist together"
    );
    let before = std::fs::read(&path)?;
    let invalid = theme::ThemeSettings {
        bar_style: "unknown".into(),
        ..loaded.view().theme
    };
    assert!(loaded.set_theme(invalid).is_err());
    assert_eq!(std::fs::read(&path)?, before);
    let invalid = theme::ThemeSettings {
        gradient_direction: "diagonal".into(),
        ..loaded.view().theme
    };
    assert!(loaded.set_theme(invalid).is_err());
    let bounded = theme::ThemeSettings {
        peak_hold_ms: 50_000,
        peak_gravity: 0,
        ..Default::default()
    }
    .normalized();
    assert_eq!(bounded.peak_hold_ms, 1_000);
    assert_eq!(bounded.peak_gravity, 40);
    println!("THEME-NATIVE-08 OK: invalid styles reject safely and peak timing stays bounded");
    Ok(())
}
