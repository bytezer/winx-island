import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

/** Bands emitted by the native analyser; views aggregate them into groups. */
const SOURCE_BANDS = 24;
/** Units a peak cap falls per emitted frame. */
const PEAK_DECAY = 0.02;

export interface SpectrumValues {
  values: number[];
  peaks: number[];
}

interface SpectrumPayload {
  bands: number[];
}

function zeros(bars: number): number[] {
  return new Array<number>(bars).fill(0);
}

/** Groups the source bands by maximum, so 24 can become 4, 12 or 24 bars. */
function aggregate(bands: number[], bars: number): number[] {
  const group = Math.max(1, Math.floor(SOURCE_BANDS / bars));
  return Array.from({ length: bars }, (_, bar) => {
    let peak = 0;
    for (let index = bar * group; index < (bar + 1) * group; index += 1) {
      peak = Math.max(peak, bands[index] ?? 0);
    }
    return peak;
  });
}

/**
 * Live spectrum pushed by the native analyzer. Events are gated on the
 * settings switch and island visibility, so an absent emitter falls back to
 * zero; peak caps decay every frame and reset when the consumer mounts.
 */
export function useSpectrum(bars: number): SpectrumValues {
  const [values, setValues] = useState<number[]>(() => zeros(bars));
  const [peaks, setPeaks] = useState<number[]>(() => zeros(bars));

  useEffect(() => {
    setValues(zeros(bars));
    setPeaks(zeros(bars));

    let disposed = false;
    const unsubscribe = listen<SpectrumPayload>("island://spectrum", (event) => {
      if (disposed) return;
      const next = aggregate(event.payload.bands, bars);
      setValues(next);
      setPeaks((current) =>
        next.map((value, index) => Math.max(value, (current[index] ?? 0) - PEAK_DECAY)),
      );
    });

    return () => {
      disposed = true;
      void unsubscribe.then((off) => off());
    };
  }, [bars]);

  return { values, peaks };
}
