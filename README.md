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
- Expanded panel with a blurred artwork backdrop and a quit action.
- Media data read from the Windows Global System Media Transport Controls
  (SMTC), so it works with Spotify, browsers, VLC and any other well-behaved
  player.
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
subsystem executable and has no console. `scripts/` contains helpers used
during development: launching, screenshots, window probing and input tests.

## Layout

```
src/                     React frontend (the island itself)
  island/                pill, hover card, panel, transport, progress
  hooks/                 media events, pointer hit-testing bridge
  lib/                   layout constants, formatting, accent extraction
src-tauri/src/
  main.rs                window creation and app wiring
  window_setup.rs        native window flags, DWM tweaks, placement
  pointer.rs             cursor polling and click-through toggling
  media.rs               SMTC polling and transport commands
  focus.rs               fullscreen detection
  commands.rs            IPC commands
```

## Notes and limitations

- Window shell surfaces (Start menu, notification centre, Task View, UAC) are
  drawn above any topmost window, so the island hides behind them.
- Exclusive fullscreen games and anti-cheat overlays can cover or block it.
- Toast notification mirroring is not implemented: Windows requires package
  identity for the notification listener.
- `winx-island` is not code signed, so SmartScreen may warn on other machines.

## License

MIT
