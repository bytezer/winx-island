import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MediaSnapshot } from "../types";

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
};

export function useMedia() {
  const [media, setMedia] = useState<MediaSnapshot>(EMPTY);
  const receivedAt = useRef<number>(performance.now());

  useEffect(() => {
    let disposed = false;
    const unsubscribe = listen<MediaSnapshot>("island://media", (event) => {
      if (disposed) return;
      receivedAt.current = performance.now();
      setMedia(event.payload);
    });
    return () => {
      disposed = true;
      void unsubscribe.then((off) => off());
    };
  }, []);

  return { media, receivedAt };
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
    // `tick` is intentionally part of the dependency list to drive re-renders.
  }, [media.positionMs, media.durationMs, media.playing, receivedAt, tick]);

  return position;
}

export async function sendMediaAction(action: "play_pause" | "next" | "prev") {
  await invoke("media_control", { action, positionMs: null });
}

export async function seekTo(positionMs: number) {
  await invoke("media_control", { action: "seek", positionMs: Math.max(0, Math.round(positionMs)) });
}
