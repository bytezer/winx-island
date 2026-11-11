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
  queueIndex: number;
  queueLength: number;
  playbackError: string | null;
  shuffleEnabled: boolean;
  repeatMode: "off" | "all" | "one";
}

export interface PointerEvent {
  inside: boolean;
}

export type MediaAction = "play_pause" | "next" | "prev" | "shuffle" | "repeat";

export type View = "compact" | "hover" | "panel";

export type PanelTab = "media" | "shortcuts";

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
}

export interface SettingsState {
  visualizerEnabled: boolean;
  appearance: Appearance;
  theme: ThemeSettings;
  lastPanelTab: PanelTab;
  shortcuts: Shortcut[];
}

export interface MusicLibraryActions {
  busy: boolean;
  error: string | null;
  onOpen: () => void;
  onFolders: () => void;
  onSystem: () => void;
}

export type VisualizerColorMode = "rgb" | "gradient" | "solid";

export type VisualizerBarStyle = "smooth" | "segmented" | "dots";

export interface ThemeSettings {
  barStyle: VisualizerBarStyle;
  gradientDirection: "horizontal" | "vertical";
  peakEnabled: boolean;
  peakHoldMs: number;
  peakGravity: number;
  islandRoundness: number;
  barRoundness: number;
  backgroundColor: string;
  raisedColor: string;
  colorMode: VisualizerColorMode;
  solidColor: string;
  gradientStart: string;
  gradientMiddle: string;
  gradientEnd: string;
  glow: boolean;
}
