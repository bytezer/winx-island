import type { CSSProperties } from "react";
import { SPECTRUM_HUES } from "./visualizer";
import type { ThemeSettings, View } from "../types";

export const DEFAULT_THEME: ThemeSettings = {
  barStyle: "smooth",
  gradientDirection: "horizontal",
  peakEnabled: false,
  peakHoldMs: 240,
  peakGravity: 180,
  islandRoundness: 100,
  barRoundness: 100,
  backgroundColor: "#0b0b0e",
  raisedColor: "#16161b",
  colorMode: "rgb",
  solidColor: "#7dd3fc",
  gradientStart: "#35e8c3",
  gradientMiddle: "#8b7bff",
  gradientEnd: "#f35ac7",
  glow: true,
};

const COLOR_FIELDS = ["backgroundColor", "raisedColor", "solidColor", "gradientStart", "gradientMiddle", "gradientEnd"] as const;

function percent(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
}

export function normalizeTheme(theme: Partial<ThemeSettings>): ThemeSettings {
  const normalized = { ...DEFAULT_THEME, ...theme };
  normalized.islandRoundness = percent(theme.islandRoundness, DEFAULT_THEME.islandRoundness);
  normalized.barRoundness = percent(theme.barRoundness, DEFAULT_THEME.barRoundness);
  normalized.colorMode = theme.colorMode && ["rgb", "gradient", "solid"].includes(theme.colorMode) ? theme.colorMode : "rgb";
  normalized.barStyle = theme.barStyle && ["smooth", "segmented", "dots"].includes(theme.barStyle) ? theme.barStyle : "smooth";
  normalized.gradientDirection = theme.gradientDirection === "vertical" ? "vertical" : "horizontal";
  normalized.peakEnabled = typeof theme.peakEnabled === "boolean" ? theme.peakEnabled : false;
  normalized.peakHoldMs = typeof theme.peakHoldMs === "number" && Number.isFinite(theme.peakHoldMs) ? Math.max(0, Math.min(1_000, Math.round(theme.peakHoldMs))) : 240;
  normalized.peakGravity = typeof theme.peakGravity === "number" && Number.isFinite(theme.peakGravity) ? Math.max(40, Math.min(400, Math.round(theme.peakGravity))) : 180;
  normalized.glow = typeof theme.glow === "boolean" ? theme.glow : DEFAULT_THEME.glow;
  for (const field of COLOR_FIELDS) {
    const color = theme[field];
    normalized[field] = typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : DEFAULT_THEME[field];
  }
  return normalized;
}

function mix(first: string, second: string, ratio: number): string {
  const channels = [1, 3, 5].map((offset) => {
    const from = parseInt(first.slice(offset, offset + 2), 16);
    const to = parseInt(second.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * ratio).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

export function barPaint(theme: ThemeSettings, index: number, count = 7) {
  if (theme.colorMode === "solid") return { base: theme.solidColor, tip: theme.solidColor };
  if (theme.colorMode === "rgb") {
    const hue = SPECTRUM_HUES[index % SPECTRUM_HUES.length];
    return { base: `hsl(${hue} 85% 48%)`, tip: `hsl(${hue + 12} 95% 76%)` };
  }
  const position = count <= 1 ? 0 : index / (count - 1);
  const base = position <= 0.5
    ? mix(theme.gradientStart, theme.gradientMiddle, position * 2)
    : mix(theme.gradientMiddle, theme.gradientEnd, (position - 0.5) * 2);
  return { base, tip: mix(base, "#ffffff", 0.22) };
}

export function themeVariables(theme: ThemeSettings, view: View = "compact"): CSSProperties {
  const background = view === "compact" ? theme.backgroundColor : theme.raisedColor;
  const [red, green, blue] = [1, 3, 5].map((offset) => parseInt(background.slice(offset, offset + 2), 16));
  const light = (red * 0.2126 + green * 0.7152 + blue * 0.0722) > 160;
  return {
    "--text": light ? "#172139" : "#f5f5f7",
    "--muted": light ? "rgba(23, 33, 57, 0.64)" : "rgba(245, 245, 247, 0.56)",
    "--muted-2": light ? "rgba(23, 33, 57, 0.42)" : "rgba(245, 245, 247, 0.34)",
    "--border": light ? "rgba(23, 33, 57, 0.14)" : "rgba(255, 255, 255, 0.085)",
    "--surface": theme.backgroundColor,
    "--surface-raised": theme.raisedColor,
    "--glow-strength": theme.glow ? 1 : 0,
  } as CSSProperties;
}

export function themeAccent(theme: ThemeSettings, artwork = "#8a8f98"): string {
  if (theme.colorMode === "solid") return theme.solidColor;
  if (theme.colorMode === "gradient") return theme.gradientMiddle;
  return artwork;
}


export const CLASSIC_SPECTRUM: Partial<ThemeSettings> = {
  barStyle: "segmented", barRoundness: 0, colorMode: "gradient", gradientDirection: "vertical",
  gradientStart: "#1265ff", gradientMiddle: "#00bdcd", gradientEnd: "#4ce84a",
  peakEnabled: true, peakHoldMs: 240, peakGravity: 180,
};

