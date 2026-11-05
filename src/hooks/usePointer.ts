import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { PointerEvent } from "../types";
import { islandRect, type IslandBox } from "../lib/layout";
import type { View } from "../types";

/**
 * Reports whether the OS cursor is inside the island rectangle. The window is
 * click-through everywhere else, so hover cannot be driven by DOM events.
 */
export function usePointerInside(): boolean {
  const [inside, setInside] = useState(false);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = listen<PointerEvent>("island://pointer", (event) => {
      if (!disposed) setInside(event.payload.inside);
    });
    return () => {
      disposed = true;
      void unsubscribe.then((off) => off());
    };
  }, []);

  return inside;
}

/** Keeps the native hit-test region in sync with the current island size. */
export function useInteractiveRect(view: View, layout: Record<View, IslandBox>) {
  useEffect(() => {
    const rect = islandRect(view, layout);
    void invoke("set_interactive_rect", { rect }).catch(() => {
      /* the window may be closing */
    });
  }, [view, layout]);
}
