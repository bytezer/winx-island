import { useEffect } from "react";
import type { Theme } from "../types";

export const THEMES: Theme[] = ["midnight", "graphite", "ocean", "glass"];

export const THEME_LABELS: Record<Theme, string> = {
  midnight: "Midnight",
  graphite: "Graphite",
  ocean: "Ocean",
  glass: "Glass",
};

/** Unknown names (hand-edited YAML) fall back to the default theme. */
export function normalizeTheme(value: string | undefined | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "midnight";
}

/**
 * Applies the active theme to the document. Both windows render the same CSS,
 * so the selector lives on `<html>` through `data-theme`.
 */
export function useTheme(theme: string | undefined) {
  useEffect(() => {
    document.documentElement.dataset.theme = normalizeTheme(theme);
  }, [theme]);
}
