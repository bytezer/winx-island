export interface MediaSnapshot {
  available: boolean;
  title: string;
  artist: string;
  album: string;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  canNext: boolean;
  canPrev: boolean;
  canSeek: boolean;
  art: string | null;
  sourceApp: string;
}

export interface PointerEvent {
  inside: boolean;
}

export type MediaAction = "play_pause" | "next" | "prev";

export type View = "compact" | "hover" | "panel";

export type PanelTab = "media" | "shortcuts";

export type Theme = "midnight" | "graphite" | "ocean" | "glass";

export interface Shortcut {
  id: string;
  kind: "folder" | "action";
  label: string;
  icon: string;
  missing: boolean;
}

export interface Appearance {
  compactWidth: number;
  compactHeight: number;
  offsetX: number;
  offsetY: number;
  theme: Theme;
}

export interface SettingsState {
  visualizerEnabled: boolean;
  appearance: Appearance;
  lastPanelTab: PanelTab;
  shortcuts: Shortcut[];
}
