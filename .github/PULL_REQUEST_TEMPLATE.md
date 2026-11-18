## What changed

<!-- One or two sentences describing the behavior change, not the file list.
     If this PR mixes a refactor with a behavior change, split it first. -->

## Why

<!-- The problem or the motivation. Link an issue if one exists. -->

## Validation

- [ ] `npm run build` passes
- [ ] `cd src-tauri && cargo xwin check --target x86_64-pc-windows-msvc` passes (Rust changes)
- [ ] The suites for the areas I touched pass — see CONTRIBUTING.md's matrix
- [ ] Verified on Windows: <!-- what you actually checked; write "n/a" if the
        change touches nothing native -->

<!-- Paste the real command output for anything that failed before your fix,
     and note anything you could not run. -->

## AI assistance

<!-- Applies to any amount of generated or assisted code. -->

- [ ] This PR contains AI-generated or AI-assisted code
- [ ] I have read it and can explain every line of it in review

<!-- If you ticked the first box, the Validation section above must reflect
     commands a human actually ran, not what the tool reported. -->

## Screenshots

<!-- Only for UI changes. Freeze deterministic states with
     WINX_START_VIEW=compact|hover|panel and WINX_START_TAB=media|shortcuts,
     forwarded through WSLENV when launching from WSL. -->
