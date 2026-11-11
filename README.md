# winx-island

A Dynamic Island style overlay for Windows 11: a floating pill pinned to the
top centre of the screen that expands on hover to show and control whatever is
playing on the system.

Built with [Tauri v2](https://tauri.app), React and Rust. The overlay is a
borderless, transparent, always-on-top window that never takes keyboard focus
and ignores clicks outside the visible pill.

## Features

- Built-in local music player: choose one or more audio files and play, pause,
  seek, or change tracks without opening Windows Media Player.
- Compact pill with live cover art and a playing waveform.
- Hover card with track metadata, transport controls and a seekable progress bar.
- Expanded panel with a blurred artwork backdrop, a shortcuts tab and a quit action.
- Media data read from the Windows Global System Media Transport Controls
  (SMTC), so it works with Spotify, browsers, VLC and any other well-behaved
  player.
- Seven-band RGB spectrum visualizer with real frequency analysis of the
  default Windows output (WASAPI loopback, 2048-point FFT). Independent bass, mid,
  and treble bars use adaptive sensitivity, fast attack and a smooth decay.
  Toggle it from the panel footer. It also works for audio from applications
  without a Windows media session. Samples are processed in memory only.
- Shortcut tab: open personal folders and built-in system actions (recycle bin,
  Windows settings, suspend).
- Configurable pill size and window position, either in settings.yaml or by
  right-dragging the island.
- Single instance enforced per session.
- Automatically hides while a fullscreen app or game is in the foreground.

## Requirements

- Windows 11 (tested on build 26300).
- WebView2 runtime (preinstalled on Windows 11).
- For development on Linux/WSL: Rust with the `x86_64-pc-windows-msvc` target,
  `cargo-xwin`, Node 20+ and `clang`/`lld`.

## Build from WSL

```bash
# once
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
npm install

# every build (assets are embedded in the executable)
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --no-bundle
```

The executable ends up in
`src-tauri/target/x86_64-pc-windows-msvc/release/winx-island.exe`.

## Development loop

The overlay is a Windows process, so it has to run on the host. The assets are
embedded in the executable, and an incremental rebuild after a UI change takes
a few seconds:

```bash
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --no-bundle
./src-tauri/target/x86_64-pc-windows-msvc/debug/winx-island.exe
```

Set `WINX_START_VIEW=compact|hover|panel` to freeze the island in one state,
which makes layout screenshots deterministic. Environment variables have to be
forwarded to the Windows process explicitly:

```bash
WSLENV=WINX_START_VIEW WINX_START_VIEW=panel ./winx-island.exe
```

Logs are written to `%TEMP%\winx-island.log` because the binary is a GUI
subsystem executable and has no console.

### Helper scripts

| Script | Purpose |
|---|---|
| `scripts/run.sh` | Restarts the Windows build from WSL and prints the log tail |
| `scripts/screenshot.ps1` | Captures a screen region to a PNG |
| `scripts/list-windows.ps1` | Lists the app's top level windows with their extended styles |
| `scripts/drag-test.ps1` | Simulates a right-button drag to check repositioning |
| `scripts/make_icons.py` | Regenerates `src-tauri/icons` without extra dependencies |

## Visualizer regression checks

```bash
npx --no-install esbuild tests/visualizer.test.tsx --bundle --platform=node --jsx=automatic --outfile=node_modules/.cache/winx-visualizer-tests.cjs
node node_modules/.cache/winx-visualizer-tests.cjs
```

These checks cover independent frequency-band rendering, silence, invalid
samples, RGB colors, playback-independent rendering, and the CSS height regression. Verify real output on Windows with
no media player open, then play audio from a browser or another application.

### Spectrum analysis checks

```bash
rustc --edition 2021 --test tests/spectrum_test.rs -o /tmp/winx-spectrum-tests
/tmp/winx-spectrum-tests
cargo xwin build --manifest-path src-tauri/Cargo.toml --example spectrum_check --release --target x86_64-pc-windows-msvc
./src-tauri/target/x86_64-pc-windows-msvc/release/examples/spectrum_check.exe
```

The Windows check plays a brief low-level bass/treble fixture and verifies the
actual loopback spectrum, independent bands and return to silence. Other audio
should be paused during this check. Add `--live` to inspect changes in currently
playing output instead. Unit tests cover quiet input, changing frequencies,
invalid samples, silence, and Float32/PCM sample decoding. The visualizer follows
the default output device; switching devices is detected within about four seconds.

## Layout

```
src/                     React frontend (the island itself)
  island/                pill, hover card, panel, transport, progress, shortcuts
  hooks/                 media, level and settings events; pointer bridge
  lib/                   layout constants, formatting, accent extraction
src-tauri/src/
  main.rs                window creation and app wiring
  window_setup.rs        native window flags, DWM tweaks, placement
  pointer.rs             cursor polling and click-through toggling
  media.rs               SMTC polling and transport commands
  audio.rs               output peak meter for the visualizer
  settings.rs            %APPDATA%\winx-island\settings.yaml
  shortcuts.rs           default shortcuts, path expansion, open actions
  focus.rs               fullscreen detection
  commands.rs            IPC commands
```

## Play music from your PC

Hover over the island and click **Add folders**. Select one or more folders
with Ctrl/Shift; their subfolders are scanned too. The island imports audio files
(`mp3`, `flac`, `wav`, `m4a`, `aac`, `wma`, `ogg`, `opus`, `aif`, `aiff`, `alac`,
`weba`, case-insensitive) and ignores documents, images, videos, and other files.
Files ending in `.mpeg` are included when their header identifies MPEG audio
(including MP3 with ID3 tags); MPEG videos are excluded. Actual playback
support depends on the codecs installed in Windows. Symbolic
links are skipped. Unreadable folders are skipped with a warning.

Adding folders appends to the existing queue, skips duplicate paths, and keeps
the current track and playback position. Choose **Files** for individual files;
this replaces the queue. Cancelling either picker leaves the selection intact.
A folder with no matching audio shows a message without changing the queue.
Folders are scanned when added; add them again to import newly created tracks.

The island plays directly using its own Windows audio engine. Previous, next,
pause/resume, seeking, and automatic advance work on the selected queue. Tags
supply the title and artist when available; otherwise the filename is shown.

The selected paths and track index are stored in
`%APPDATA%\winx-island\local-player.json`. Restarting restores the selection
paused; press Play to resume. Music files are never copied or modified. Use
**Windows** beside the queue count to pause local playback and control another
application through Windows media controls. Missing or unsupported files show
an error; choose another file or advance to the next track to recover.

### Local player checks

```bash
rustc --test tests/music_library_test.rs -o /tmp/winx-music-library-tests
/tmp/winx-music-library-tests
rustc --test tests/music_queue_test.rs -o /tmp/winx-music-queue-tests
/tmp/winx-music-queue-tests
npx --no-install esbuild tests/local_player_ui.test.tsx --bundle --platform=node --jsx=automatic --outfile=node_modules/.cache/winx-local-player-ui-tests.cjs
node node_modules/.cache/winx-local-player-ui-tests.cjs
cargo xwin build --manifest-path src-tauri/Cargo.toml --example local_player_check --release --target x86_64-pc-windows-msvc
./src-tauri/target/x86_64-pc-windows-msvc/release/examples/local_player_check.exe
```

The Windows integration check generates silent WAV fixtures in an isolated
`%TEMP%` directory. It checks actual playback, pause/resume, seeking, automatic
advance, restoration, mode switching, and missing-file recovery without changing
the application's saved queue.

Local playback also has **Aleatorio** and **Repetición** buttons beside the
transport controls. Repeat cycles through off, the whole list, and one track.
Repeat-one applies at the end of a track; Next still skips forward. Shuffle visits
each track once per cycle, and Previous follows the listening history. These
preferences persist with the local queue in `local-player.json`; they do not
change playback modes in other Windows applications.

Seeking previews the position while dragging and commits when released. Clicking
or dragging the timeline does not toggle the expanded view.

## Customize the island

Open the expanded panel and click its settings icon (**Personalizar apariencia**).
The editor is a separate, focusable window with an animated preview; the overlay
continues running. Preview the compact, hover and panel views before saving.

- Choose capsule, softly rounded or square corners, or adjust island roundness.
- Choose continuous bars, segmented LEDs or dots. Set the ends independently
  for continuous and segmented bars, from square to rounded.
- Keep the original RGB palette, choose a three-color gradient, or use one solid color.
- Pick compact/expanded background colors and toggle the subtle glow.
- Enable independent peak markers with adjustable hold time and gravity-based
  fall speed. Gradients can run across columns or vertically with bar energy.
- Try **Clásico con picos** for blue-to-green segmented bars with falling peak
  indicators, then save if you want to apply the preset.
- Preview with sample animation or the real Windows audio spectrum.

**Guardar y aplicar** saves the theme and updates the island immediately.
**Cancelar** discards the unsaved draft. **Restablecer aspecto** resets the draft
to the original look; save to apply it. Existing files without a `theme` section
keep their previous appearance. Geometry, position, shortcuts and the music queue
are preserved. The editor also retains access to the YAML settings file.

Theme values are stored under `theme` in `settings.yaml`:

```yaml
theme:
  barStyle: smooth      # smooth | segmented | dots
  gradientDirection: horizontal  # horizontal | vertical
  peakEnabled: false
  peakHoldMs: 240        # 0-1000 ms
  peakGravity: 180       # 40-400; higher values fall faster
  islandRoundness: 100   # 0 = square, 100 = original rounded shape
  barRoundness: 100
  backgroundColor: '#0b0b0e'
  raisedColor: '#16161b'
  colorMode: rgb        # rgb | gradient | solid
  solidColor: '#7dd3fc'
  gradientStart: '#35e8c3'
  gradientMiddle: '#8b7bff'
  gradientEnd: '#f35ac7'
  glow: true
```

Theme regression checks:

```bash
npx --no-install esbuild tests/theme.test.tsx --bundle --platform=node --jsx=automatic --outfile=node_modules/.cache/winx-theme-tests.cjs
node node_modules/.cache/winx-theme-tests.cjs
cargo xwin build --manifest-path src-tauri/Cargo.toml --example theme_check --release --target x86_64-pc-windows-msvc
./src-tauri/target/x86_64-pc-windows-msvc/release/examples/theme_check.exe
```

Peak motion and bar styles also have focused checks:

```bash
npx --no-install esbuild tests/peaks.test.ts --bundle --platform=node --outfile=node_modules/.cache/winx-peak-tests.cjs
node node_modules/.cache/winx-peak-tests.cjs
npx --no-install esbuild tests/spectrum_rendering.test.ts --bundle --platform=node --outfile=node_modules/.cache/winx-spectrum-rendering-tests.cjs
node node_modules/.cache/winx-spectrum-rendering-tests.cjs
npx --no-install esbuild tests/bar_styles.test.tsx --bundle --platform=node --jsx=automatic --loader:.css=empty --outfile=node_modules/.cache/winx-bar-style-tests.cjs
node node_modules/.cache/winx-bar-style-tests.cjs
```

The active view draws bars and peaks together on a transparent Canvas 2D surface.
Animation state is shared when switching views. Bars use critically damped motion
with continuous velocity. A collision combines the marker's falling velocity and the bar's upward
velocity to launch it; it flies independently until the next collision. Gravity
and impact restitution give quick arcs; launch height is capped to keep strong
hits short. Resting contact does not generate new bounces. Configured hold remains
optional.
Bars respond to a beat without waiting for the airborne marker, and native
frequency smoothing is kept short to avoid adding a second slow release. Peak hold/fall uses elapsed time;
equal levels and tiny fluctuations do not restart the hold timer. Peak clearance
stays inside the available height. A caught marker touches the visible bar top,
including segmented and dotted styles. The leading segment or dot follows the
continuous bar height; peak positions are never snapped to the cell grid.
With reduced motion enabled, markers follow
the bands without the extra falling animation. No separate audio capture is
started for these visual styles. The native overlay explicitly uses a transparent
background and disables the Windows redirection bitmap.

The native check uses a temporary settings directory; it covers legacy files,
persistence, invalid values, write failures and concurrent position/theme updates.

## Settings

`%APPDATA%\winx-island\settings.yaml` is created with defaults on first run:

```yaml
visualizer:
  enabled: true
appearance:
  compactWidth: 132     # collapsed pill, logical px (100-320)
  compactHeight: 40     # 28-64
  offsetX: 0            # window offset from the top-centre anchor (-200..200)
  offsetY: 0            # -10..200
shortcuts:
  - id: downloads
    kind: folder
    label: Downloads
    icon: download
    path: "%USERPROFILE%\\Downloads"
  - id: suspend
    kind: action
    label: Suspend
    icon: suspend
ui:
  lastPanelTab: media
```

Right-drag the island with the right mouse button to move it; the resulting
offset is written back to `appearance.offsetX` / `offsetY` and clamped to the
ranges above so the hit-test canvas always stays on screen.

Paths may use `%VAR%` environment expansion. Folder shortcuts are disabled and
drawn in red while their target is missing. Edits to `shortcuts` or
`lastPanelTab` are picked up on the next start; switching tabs in the panel and
toggling the visualizer write the file immediately.

- Window shell surfaces (Start menu, notification centre, Task View, UAC) are
  drawn above any topmost window, so the island hides behind them.
- Exclusive fullscreen games and anti-cheat overlays can cover or block it.
- Toast notification mirroring is not implemented: Windows requires package
  identity for the notification listener.
- `winx-island` is not code signed, so SmartScreen may warn on other machines.

## License

Copyright (C) 2026 bytezer

winx-island is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 2 of the License, or (at your option) any later
version.

It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
PURPOSE. See the GNU General Public License for more details.

The full text is in [LICENSE](LICENSE). If you redistribute a build of this
program, the GPL requires you to make the corresponding source code available
to whoever receives it: ship this repository (or a link to it) alongside the
binary, and keep any modifications under the same license.
