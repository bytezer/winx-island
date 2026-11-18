# Contributing to winx-island

winx-island is a Windows 11 Dynamic Island style overlay built with Tauri v2,
React 19 and Rust. Two documents map the project before you write anything:

- **[README.md](README.md)** — the feature and module map, plus the build
  commands and every regression suite.
- **[AGENTS.md](AGENTS.md)** — the hard constraints that are easy to get
  wrong: window creation, WebView2 quirks, media threading, the palette and
  the catalogs. Read it if your change touches windows, media or settings.

## Prerequisites

- **Windows 11** to run the app. WebView2 is preinstalled there; there is no
  Linux or macOS build — the Rust side depends on the `windows` crate.
- The build works from **WSL or from Windows**. You need Node 20+, a Rust
  toolchain, the `x86_64-pc-windows-msvc` target, `cargo-xwin`, and `clang` /
  `lld`:

  ```bash
  # once
  rustup target add x86_64-pc-windows-msvc
  cargo install --locked cargo-xwin
  npm install
  ```

## Language rules

Everything committed to this repository is in **English**: code, identifiers,
comments, docs, commit messages and logs.

The single exception is **user-facing interface text**, which is data:

- It lives in `locales/en.json` and `locales/es.json`. Both catalogs must keep
  the exact same key set; `tests/i18n.test.ts` enforces it.
- React components resolve labels with `t()` from `src/i18n/LocaleContext`.
  Never hardcode a UI string in a component.
- Rust commands return catalog **keys** (for example `error.no_session`), not
  sentences — the frontend resolves them at render time.
- The system tray menu is the one surface the OS draws for us, so
  `src-tauri/src/catalog.rs` renders that text itself from the same catalogs.

## Workflow

`main` is protected by two rulesets:

- Changes go through a **pull request** (no approving reviews are required, so
  you can merge your own PR once it is open).
- Merges are **squash or rebase only** — the branch keeps a linear history and
  no merge commits.
- **Force pushes and branch deletion are blocked for everyone.**

If you have write access, branch directly from `main`
(`feat/tray-icon`, `fix/shuffle-repeat`); otherwise fork first. Branch from
the latest `main`, and rebase if it moved while you worked.

**One logical change per pull request.** A PR that mixes a refactor with a
behavior change and a test sweep is hard to review and will be asked to split.

## Commits

Conventional Commits, with a scope that matches the area you touched:

```
feat(tray): add a system tray icon with a localized menu
refactor(settings): merge the appearance window into the settings window
fix(media): pause local playback when switching to system mode
docs: document the glass theme and shell surface
```

The summary is imperative, lowercase after the colon, 72 characters or fewer,
with no trailing period. One logical change per commit, never mixed with
unrelated reformatting.

## Before you open the pull request

Two commands always run, whatever you touched:

```bash
npm run build                    # tsc --noEmit && vite build
cd src-tauri && cargo xwin check --target x86_64-pc-windows-msvc
```

Then the suites that match your area. The README documents every one of them
with its exact command — see its **Regression checks** sections:

| You touched | Suites |
|---|---|
| Island or settings UI | `visualizer`, `local_player_ui`, `bar_styles`, `settings_ui` (JS) |
| Pure Rust modules (media, queue, library) | `music_queue_test`, `music_library_test`, `media_choice_test`, `spectrum_test`, `positioning_test` |
| `locales/*` | `i18n.test.ts` — it also fails when the two catalogs diverge |
| Settings CSS or the studio palette | `studio_css.test.ts` and `settings_ui.test.tsx` |
| Native behavior (windows, media, tray) | the `.exe`, verified by hand on Windows |

The suites are standalone one-liners — an `esbuild` bundle piped into `node`
for the JS ones, plain `rustc --test` for the pure Rust ones. None of them
needs Windows, which is why the whole matrix runs from WSL.

## Verifying on Windows

Some things only exist on the real app, and a build that compiles is not a
build that works. Before claiming native behavior:

- The binary is a `windows_subsystem` executable: **stdout is invisible**.
  Diagnostics land in `%TEMP%\winx-island.log`, which is deleted on startup.
  From WSL, `scripts/run.sh` restarts the running exe and tails that log.
- Freeze the UI for deterministic screenshots with `WINX_START_VIEW=compact|hover|panel`
  and `WINX_START_TAB=media|shortcuts`, forwarding them through `WSLENV`.
- The checklist the maintainers actually run: media controls with a real
  player, click-through outside the pill, hover expansion, right-drag
  repositioning, settings persistence across a restart, fullscreen auto-hide,
  and the tray (left-click toggles the island, right-click opens the menu, the
  labels follow the language).

## AI-assisted contributions

Code generated or assisted by AI is welcome under three rules:

1. **Disclose it.** Tick the box in the pull request template.
2. **You answer for it.** You have read the code and can explain any line of
   it during review. "The model wrote it" is not an answer.
3. **The toolchain is the arbiter, not the model.** The validation section of
   your PR reflects commands a human actually ran, with their real output.
   A generated build that claims `cargo check` passes but was never compiled
   is not a contribution yet.

These rules exist because the tooling keeps catching what the model misses:
here the compiler has rejected APIs the assistant treated as valid (a
deprecated tray builder method, an image constructor gated behind a cargo
feature), and review has found real bugs in generated code whose description
read "tests pass".

## The hard constraints

[AGENTS.md](AGENTS.md) is the source of truth. The short version of what it
protects:

- Windows are built imperatively in Rust; window flags do not go in the
  Tauri config, and the settings window is never passed to click-through
  logic.
- Creating a second webview breaks the transparent island's composition:
  the hide-and-reload dance in `settings_window.rs` is load-bearing.
- WinRT objects are `!Send`: all media work stays on the media thread, and
  commands enqueue through `media::Controller`.
- Commands that create or reposition windows must be `async` — a synchronous
  one deadlocks the event loop.
- The settings window paints from `src/settings/studio.css`; no hardcoded
  chrome colors in its stylesheets.

If your change touches any of these, say in the PR how you verified the
constraint still holds.

## For maintainers

The repository admin can push `main` directly; the protection ruleset grants
that bypass while still blocking force pushes and deletion for everyone.
Everything else goes through a pull request, and merging your own PR is fine —
the PR record is the point.
