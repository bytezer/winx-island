import type { UiError } from "./i18n/errors";

export interface MediaSource {
  id: string;
  label: string;
  title: string;
  playing: boolean;
}

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
  canPlayPause?: boolean;
  sourceSelection?: string;
  selectedSourceId?: string;
  sources?: MediaSource[];
}

export interface PointerEvent {
  inside: boolean;
}

export type MediaAction = "play_pause" | "next" | "prev" | "shuffle" | "repeat";

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
  theme: ThemeSettings;
  /** Locale in use, already resolved by the native side ("en" | "es"). */
  language: string;
  /** Raw preference; null follows the Windows display language. */
  languageOverride: string | null;
  lastPanelTab: PanelTab;
  shortcuts: Shortcut[];
}

export interface MusicLibraryActions {
  busy: boolean;
  error: UiError | null;
  onOpen: () => void;
  onFolders: () => void;
  onSystem: () => void;
  onSource?: (id: string) => void;
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
