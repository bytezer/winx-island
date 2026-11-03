import type { MediaSnapshot } from "../types";
import { CoverArt } from "./CoverArt";
import { ProgressBar } from "./ProgressBar";
import { Transport } from "./Transport";

interface HoverCardProps {
  media: MediaSnapshot;
  positionMs: number;
  onAction: (action: "play_pause" | "next" | "prev") => void;
  onSeek: (positionMs: number) => void;
}

export function HoverCard({ media, positionMs, onAction, onSeek }: HoverCardProps) {
  return (
    <div className="hover-card">
      <div className="hover-main">
        <CoverArt src={media.art} size={78} radius={16} />
        <div className="meta">
          <div className="meta-title">{media.available ? media.title || "Unknown track" : "Nothing playing"}</div>
          <div className="meta-sub">
            {media.available ? media.artist || "Unknown artist" : "Start playback in any app"}
          </div>
          {media.available && media.album && <div className="meta-album">{media.album}</div>}
        </div>
        <Transport media={media} onAction={onAction} />
      </div>

      <ProgressBar
        positionMs={positionMs}
        durationMs={media.durationMs}
        enabled={media.available && media.canSeek}
        showTimes={media.durationMs > 0}
        onSeek={onSeek}
      />
    </div>
  );
}
