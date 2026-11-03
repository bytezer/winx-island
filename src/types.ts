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
