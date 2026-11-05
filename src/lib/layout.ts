import type { Appearance, View } from "../types";

/** Size of the transparent window. Everything the island needs must fit here. */
export const CANVAS_WIDTH = 560;
export const CANVAS_HEIGHT = 380;
export const CANVAS_TOP_PADDING = 10;

export interface IslandBox {
  width: number;
  height: number;
  radius: number;
}

export const LAYOUT: Record<View, IslandBox> = {
  compact: { width: 132, height: 40, radius: 20 },
  hover: { width: 462, height: 142, radius: 26 },
  panel: { width: 462, height: 280, radius: 28 },
};

/** Compact pill size is user configurable; hover and panel keep their layout. */
export function layoutFor(appearance: Appearance): Record<View, IslandBox> {
  const width = Math.min(320, Math.max(100, appearance.compactWidth || 132));
  const height = Math.min(64, Math.max(28, appearance.compactHeight || 40));
  return {
    ...LAYOUT,
    compact: { width, height, radius: Math.min(height / 2, 22) },
  };
}

export function islandRect(view: View, layout: Record<View, IslandBox>) {
  const box = layout[view];
  return {
    x: (CANVAS_WIDTH - box.width) / 2,
    y: CANVAS_TOP_PADDING,
    w: box.width,
    h: box.height,
  };
}
