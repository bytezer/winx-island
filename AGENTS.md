# Repository Guidelines

## Project Structure & Module Organization

winx-island is a Windows 11 desktop overlay built with Tauri v2, React 19, TypeScript, and Rust.

- `src/island/`: pill, hover card, panel, media controls, and shortcut components.
- `src/hooks/`: media, audio level, settings, and pointer integration.
- `src/lib/`: layout constants, formatting, and accent extraction; shared types live in `src/types.ts`.
- `src-tauri/src/`: native window behavior, media/audio polling, settings, shortcuts, and IPC commands.
- `src-tauri/icons/`: application icons; `scripts/` contains WSL and PowerShell helpers.
- `dist/` and `src-tauri/target/`: generated build output; do not commit these directories.

## Build, Test, and Development Commands

Use Node 20+ and a Rust toolchain. WSL cross-compilation also requires the `x86_64-pc-windows-msvc` target, `cargo-xwin`, and `clang`/`lld`.

- `npm install`: install frontend dependencies.
- `npm run dev`: start Vite on port 5274; native integrations require the Windows app.
- `npm run build`: run strict TypeScript checks and build frontend assets.
- `npm run preview`: preview the built frontend.
- `npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --no-bundle`: build the Windows executable from WSL.
- `bash scripts/run.sh`: restart the existing Windows release executable from WSL and display recent logs.

## Coding Style & Naming Conventions

Match existing code: two-space indentation, double quotes, and semicolons in TypeScript; four-space indentation and snake_case functions/modules in Rust. Use PascalCase component filenames (`HoverCard.tsx`), `use`-prefixed hooks (`useSettings.ts`), and camelCase TypeScript functions. Keep IPC payloads consistent with `src/types.ts` and Rust serialization. No dedicated formatter or lint script is configured.

## Testing Guidelines

No automated test framework or coverage threshold is configured. Run `npm run build`, then verify native changes on Windows: media controls, click-through behavior, hover expansion, dragging, settings persistence, and fullscreen hiding. Use `scripts/drag-test.ps1` for repositioning checks and `scripts/screenshot.ps1` for visual evidence. Set `WINX_START_VIEW=compact|hover|panel` for deterministic screenshots; forward it through `WSLENV` when launching from WSL.

## Commit & Pull Request Guidelines

History uses concise, imperative subjects with `feat:`, `fix:`, and `chore:` prefixes. Keep changes focused. PRs should describe behavior changes, include validation steps and results, link related issues when available, and attach screenshots for UI changes.

## Configuration & Diagnostics

Runtime settings live in `%APPDATA%\winx-island\settings.yaml`; logs live in `%TEMP%\winx-island.log`. Keep personal paths and machine-specific configuration out of commits.
