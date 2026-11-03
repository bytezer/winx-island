import type { View } from "../types";

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

export function islandRect(view: View) {
  const box = LAYOUT[view];
  return {
    x: (CANVAS_WIDTH - box.width) / 2,
    y: CANVAS_TOP_PADDING,
    w: box.width,
    h: box.height,
  };
}
