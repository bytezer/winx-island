import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

/**
 * Smoothed output peak pushed by the native peak meter. Events are gated on
 * the settings switch, so an absent emitter falls back to zero.
 */
export function useLevel(): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = listen<{ level: number }>("island://level", (event) => {
      if (!disposed) setLevel(event.payload.level);
    });
    return () => {
      disposed = true;
      void unsubscribe.then((off) => off());
    };
  }, []);

  return level;
}
