import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { toUiError, type UiError } from "../i18n/errors";
import type { MediaAction, MediaSnapshot, MusicLibraryActions } from "../types";

const EMPTY: MediaSnapshot = {
  available: false,
  title: "",
  artist: "",
  album: "",
  playing: false,
  positionMs: 0,
  durationMs: 0,
  canNext: false,
  canPrev: false,
  canSeek: false,
  art: null,
  sourceApp: "",
  queueIndex: 0,
  queueLength: 0,
  playbackError: null,
  shuffleEnabled: false,
  repeatMode: "off",
  sourceSelection: "auto",
  canPlayPause: true,
  sources: [],
};

export function useMedia() {
  const [media, setMedia] = useState<MediaSnapshot>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const pickerOpen = useRef(false);
  const receivedAt = useRef<number>(performance.now());
  const hasEvent = useRef(false);

  useEffect(() => {
    let disposed = false;

    // The island is reloaded when the settings window is first created. The
    // poller only emits on media changes, so pull the cached snapshot once for
    // the gap between mount and the next event.
    void invoke<MediaSnapshot>("get_media_snapshot")
      .then((value) => {
        if (disposed || hasEvent.current) return;
        receivedAt.current = performance.now();
        setMedia(value);
      })
      .catch(() => {
        /* the window may be closing */
      });

    const unsubscribe = listen<MediaSnapshot>("island://media", (event) => {
      if (disposed) return;
      hasEvent.current = true;
      receivedAt.current = performance.now();
      setMedia(event.payload);
    });
    void unsubscribe.then(() => {
      if (!disposed) return invoke("refresh_media");
    }).catch((reason: unknown) => {
      if (!disposed) setError(toUiError(reason));
    });
    return () => {
      disposed = true;
      void unsubscribe.then((off) => off()).catch(() => {});
    };
  }, []);

  const chooseMusic = useCallback(async (command: "open_music_files" | "add_music_folders") => {
    if (pickerOpen.current) return;
    pickerOpen.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await invoke<boolean | { found: number; skippedFolders: number } | null>(command);
      if (result && typeof result === "object" && result.skippedFolders > 0) {
        setError({ key: "error.folders_skipped", params: { count: result.skippedFolders } });
      }
    } catch (reason) {
      setError(toUiError(reason));
    } finally {
      pickerOpen.current = false;
      setBusy(false);
    }
  }, []);

  const onOpen = useCallback(() => chooseMusic("open_music_files"), [chooseMusic]);
  const onFolders = useCallback(() => chooseMusic("add_music_folders"), [chooseMusic]);

  const onSystem = useCallback(async () => {
    setError(null);
    try {
      await invoke("use_system_media");
    } catch (reason) {
      setError(toUiError(reason));
    }
  }, []);

  const onSource = useCallback(async (id: string) => {
    setError(null);
    try { await invoke("select_media_source", { id }); }
    catch (reason) { setError(toUiError(reason)); }
  }, []);

  const onAction = useCallback(async (action: MediaAction) => {
    if (action === "play_pause" && !media.available && !media.sourceSelection) {
      await onFolders();
      return;
    }
    setError(null);
    try {
      await sendMediaAction(action);
    } catch (reason) {
      setError(toUiError(reason));
    }
  }, [media.available, media.sourceSelection, onFolders]);

  const onSeek = useCallback(async (positionMs: number) => {
    setError(null);
    try {
      await seekTo(positionMs);
    } catch (reason) {
      setError(toUiError(reason));
    }
  }, []);

  const library: MusicLibraryActions = {
    busy,
    // Native errors arrive as catalog keys; `translate` leaves anything else alone.
    error: error ?? (media.playbackError ? { key: media.playbackError } : null),
    onOpen,
    onFolders,
    onSystem,
    onSource,
  };
  return { media, receivedAt, library, onAction, onSeek };
}

/** Playhead position, interpolated locally so the progress bar moves smoothly. */
export function usePlayhead(media: MediaSnapshot, receivedAt: RefObject<number>, active: boolean) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active || !media.playing) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => window.clearInterval(interval);
  }, [active, media.playing]);

  const position = useMemo(() => {
    if (!media.playing) return media.positionMs;
    const elapsed = performance.now() - receivedAt.current;
    const next = media.positionMs + elapsed;
    return media.durationMs > 0 ? Math.min(next, media.durationMs) : next;
  }, [media.positionMs, media.durationMs, media.playing, receivedAt, tick]);

  return position;
}

export async function sendMediaAction(action: MediaAction) {
  await invoke("media_control", { action, positionMs: null });
}

export async function seekTo(positionMs: number) {
  await invoke("media_control", { action: "seek", positionMs: Math.max(0, Math.round(positionMs)) });
}
