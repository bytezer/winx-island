# AGENTS.md

Windows-only Tauri v2 desktop overlay (React 19 + Rust). There is no Linux or
macOS build: the Rust side depends on the `windows` crate and Win32/WinRT APIs.
The README is the feature and module map; below are the build and runtime facts
that are easy to get wrong.

## Language

Everything committed to the repository must be in English, regardless of the
language used in chat: code, identifiers, comments, UI strings, docs, commit
messages, logs, and PR text.

## Commands

Prerequisites (once): `rustup target add x86_64-pc-windows-msvc`,
`cargo install --locked cargo-xwin`, `npm install`.

- Frontend typecheck + production bundle: `npm run build`
  (`tsc --noEmit && vite build`).
- Rust check, from `src-tauri/`:
  `cargo xwin check --target x86_64-pc-windows-msvc`.
  A plain `cargo check` fails on Linux because `main.rs` uses the `windows`
  crate, which is only a `cfg(windows)` dependency.
- Full Windows build from WSL (also rebuilds `dist/` and embeds it into the
  executable):
  `npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --no-bundle`
  Add `--debug` for the fast iteration build. Without it the output is
  `src-tauri/target/x86_64-pc-windows-msvc/release/winx-island.exe`; with it,
  the equivalent `debug/` path.
- There is no test suite, JS linter, or formatter config. `npm run build` and
  the cargo check above are the available verification steps.
- `npm run dev` serves only the web UI on strict port 5274; Tauri IPC and media
  events are unavailable in a browser. To exercise the real app, build and run
  the `.exe` as above.
- `scripts/run.sh` does **not** build. It kills the running `winx-island.exe`,
  starts the existing binary, and tails its log. `PROFILE` defaults to
  `release`; use `PROFILE=debug scripts/run.sh` for a debug build.

## Debugging

- The binary is `#![windows_subsystem = "windows"]`, so stdout is invisible.
  Rust diagnostics go through `logline!` to `%TEMP%\winx-island.log`, which is
  deleted on startup. From WSL, `scripts/run.sh` resolves and tails that path.
- Freeze the UI for deterministic screenshots with
  `WINX_START_VIEW=compact|hover|panel` and
  `WINX_START_TAB=media|shortcuts`. They are read in `main.rs` and injected
  into the page. Environment variables must be forwarded explicitly:
  `WSLENV=WINX_START_VIEW:WINX_START_TAB WINX_START_VIEW=panel WINX_START_TAB=media ./src-tauri/target/x86_64-pc-windows-msvc/debug/winx-island.exe`

## Architecture constraints

- The window is built imperatively in `src-tauri/src/main.rs`;
  `tauri.conf.json` intentionally has `app.windows: []`. Window flags belong in
  Rust, not in the Tauri config.
- There are two windows. `island` is the overlay described below. `settings` is
  a normal, focusable 693x420 window created on demand by
  `src-tauri/src/settings_window.rs` (label `settings`, the same `index.html`,
  `window.__winxSettingsWindow = true` injected so the frontend renders
  `src/settings/SettingsApp.tsx`). It must never be passed to
  `pointer.rs`, `window_setup::configure` or any click-through / no-activate
  logic: those only target `island`. It is destroyed on close and recreated by
  the next `open_settings`. Both windows share
  `src-tauri/capabilities/default.json`, so new window permissions must stay
  valid for both.
- Creating the `settings` webview breaks the transparent island's WebView2
  composition on Windows: the pill keeps its background but paints no content.
  `settings_window.rs` therefore hides and reloads the island on first creation;
  the island's `on_page_load` handler shows it again. Reusing an existing
  settings window does not trigger this. Do not remove the reload without
  verifying the island still renders after the second webview exists.
- The island is click-through except where the native pointer poller says
  otherwise. `src-tauri/src/pointer.rs` polls the cursor every 16 ms, receives
  the active rect from the frontend via `set_interactive_rect`, and emits
  `island://pointer`. DOM hover cannot work outside the pill.
- Canvas geometry is duplicated in `src/lib/layout.ts` (`CANVAS_WIDTH`,
  `LAYOUT`) and `src-tauri/src/window_setup.rs` (`CANVAS_WIDTH`/`HEIGHT`), with
  a default hit-test rect also hardcoded in `pointer.rs`. Update all three when
  changing the canvas or pill size.
- SMTC/WinRT objects are `!Send`, so all media work runs on one thread in
  `media.rs`; IPC commands enqueue through `media::Controller`. Do not call
  WinRT from Tauri commands directly. The controller also caches the latest
  snapshot; `get_media_snapshot` and `useMedia` use it to restore media after
  the island reload without waiting for a change event.
- The visualizer spectrum is WASAPI loopback on the default render endpoint
  (`src-tauri/src/audio/capture.rs`), analysed by an in-repo radix-2 FFT
  (`src-tauri/src/audio/spectrum.rs`). The audio thread owns the capture and
  analyzer, re-resolves the device periodically and emits 24 bands on
  `island://spectrum` only while the island is visible and
  `visualizer.enabled` is on; views aggregate those 24 bands themselves
  (`useSpectrum`). Do not add an FFT dependency or a per-view IPC command.
- Settings live in `%APPDATA%\winx-island\settings.yaml`, are loaded once at
  startup into `Settings`, and are written only when a value changes
  (visualizer toggle, panel tab, theme, pill size, drag offsets, reset). Hand
  edits to shortcuts require a restart, and edits made while the app is running
  can be overwritten.
- `appearance.theme` is one of `midnight` (default), `graphite`, `ocean`,
  `glass`; the Rust validator lives in `settings.rs` (`THEMES`, `is_valid_theme`)
  and the frontend mirrors it in `src/hooks/useTheme.ts`. Themes are CSS token
  sets on `:root[data-theme=...]` in `src/styles.css`; `useTheme` sets the
  attribute in both windows. A YAML file without `theme` must keep loading as
  `midnight`.
- The glass theme is simulated in CSS (translucency, specular rim, a `::after`
  reflection/noise layer). WebView2 cannot blur the desktop behind a
  transparent window, so `backdrop-filter` on the island is a no-op: never add
  it. The only real blur is the album-art `.panel-backdrop`.
- The settings window is not transparent, so its shell uses the opaque
  `--shell-surface` token, not `--surface` (which is translucent in glass and
  would let WebView2's white page show through).
- IPC surface: `set_interactive_rect`, `media_control`, `get_media_snapshot`,
  `get_settings`,
  `set_visualizer_enabled`, `set_panel_tab`, `set_theme`, `set_compact_size`,
  `reset_position`, `open_settings`, `close_settings`, `app_version`,
  `open_shortcut`, `open_settings_location`, `begin_drag`, `quit_app`. The
  settings commands persist and re-emit `island://settings`, which both windows
  listen to.
- Sync Tauri commands run on the main thread. Commands that create, close or
  reposition windows (`open_settings`, `close_settings`, `reset_position`) must
  be `async`; making them sync makes `WebviewWindowBuilder::build()` wait on the
  event loop it is blocking, so the settings window is created hidden and never
  shown.
- `shortcuts::default_entries()` hardcodes the author's WSL distro
  (`Ubuntu-26.04`); those paths are local defaults, not portable ones.
- Register new IPC commands in `main.rs`'s `invoke_handler`; frontend wrappers
  live in `src/hooks/`. Serde structs use camelCase, mirrored in
  `src/types.ts`, so keep both sides in sync.
