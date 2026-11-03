#!/usr/bin/env bash
# Restarts the Windows build of the overlay from WSL and shows the log path.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="x86_64-pc-windows-msvc"
PROFILE="${PROFILE:-release}"
EXE="$ROOT/src-tauri/target/$TARGET/$PROFILE/winx-island.exe"

if [[ ! -f "$EXE" ]]; then
  echo "missing executable: $EXE" >&2
  echo "build it with: npm run tauri build -- --runner cargo-xwin --target $TARGET --no-bundle" >&2
  exit 1
fi

taskkill.exe /IM winx-island.exe /F >/dev/null 2>&1 || true
sleep 0.4

LOG_WIN="$(cmd.exe /c 'echo %TEMP%' 2>/dev/null | tr -d '\r')"
LOG_WSL="/mnt/$(echo "$LOG_WIN" | sed 's|^\([A-Za-z]\):\\|\L\1/|; s|\\|/|g')/winx-island.log"

"$EXE" &
sleep 1.2

if [[ -f "$LOG_WSL" ]]; then
  echo "--- $LOG_WSL"
  tail -20 "$LOG_WSL"
else
  echo "log not found yet at $LOG_WSL"
fi
