# winx-island

A Dynamic Island style overlay for Windows 11: a floating pill pinned to the
top centre of the screen that expands on hover to show and control whatever is
playing on the system.

Built with [Tauri v2](https://tauri.app), React and Rust. The overlay is a
borderless, transparent, always-on-top window that never takes keyboard focus
and ignores clicks outside the visible pill.

## Features

- Compact pill with live cover art and a playing waveform.
- Hover card with track metadata, transport controls and a seekable progress bar.
- Expanded panel with a blurred artwork backdrop, a shortcuts tab and a quit action.
- Media data read from the Windows Global System Media Transport Controls
  (SMTC), so it works with Spotify, browsers, VLC and any other well-behaved
  player.
- Peak meter visualizer driven by the output device (IAudioMeterInformation),
  togglable from the panel footer.
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
