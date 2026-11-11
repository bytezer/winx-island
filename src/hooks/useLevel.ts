import { listen } from "@tauri-apps/api/event";
import { useSyncExternalStore } from "react";

interface AudioSnapshot {
  level: number;
  bands: number[];
}

const EMPTY: AudioSnapshot = { level: 0, bands: Array(7).fill(0) };
let snapshot = EMPTY;
let disconnect: (() => void) | undefined;
const subscribers = new Set<() => void>();

function bounded(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function subscribe(onChange: () => void) {
  subscribers.add(onChange);
  if (subscribers.size === 1) {
    let active = true;
    const subscription = listen<{ level: number; bands: number[] }>("island://level", (event) => {
      if (!active) return;
      snapshot = {
        level: bounded(event.payload.level),
        bands: Array.from({ length: 7 }, (_, index) => bounded(event.payload.bands?.[index])),
      };
      subscribers.forEach((notify) => notify());
    });
    disconnect = () => {
      active = false;
      void subscription.then((off) => off()).catch(() => {});
    };
    void subscription.catch(() => {});
  }
  return () => {
    subscribers.delete(onChange);
    if (subscribers.size === 0) {
      disconnect?.();
      disconnect = undefined;
      snapshot = EMPTY;
    }
  };
}

function getLevel() {
  return snapshot.level;
}

function getBands() {
  return snapshot.bands;
}

export function useLevel(): number {
  return useSyncExternalStore(subscribe, getLevel, getLevel);
}

export function useSpectrum(): number[] {
  return useSyncExternalStore(subscribe, getBands, getBands);
}
