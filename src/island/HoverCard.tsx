import { MusicLibraryControls } from "./MusicLibraryControls";
import { useLevel } from "../hooks/useLevel";
import { AUDIO_NOISE_FLOOR } from "../lib/visualizer";
import type { MediaAction, MediaSnapshot, MusicLibraryActions } from "../types";
import { CoverArt } from "./CoverArt";
import { ProgressBar } from "./ProgressBar";
import { MiniVisualizer } from "./MiniVisualizer";
import { Transport } from "./Transport";

interface HoverCardProps {
  media: MediaSnapshot;
  library: MusicLibraryActions;
  positionMs: number;
  visualizer: boolean;
  onAction: (action: MediaAction) => void;
  onSeek: (positionMs: number) => void;
}

export function HoverCard({ media, library, positionMs, visualizer, onAction, onSeek }: HoverCardProps) {
  const systemAudio = useLevel() > AUDIO_NOISE_FLOOR && visualizer;
  return (
    <div className="hover-card">
      <div className="hover-main">
        <CoverArt src={media.art} size={78} radius={16} />
        <div className="meta">
          <div className="meta-title">{media.available ? media.title || "Unknown track" : systemAudio ? "System audio" : "Your music, right here"}</div>
          <div className="meta-sub">
            {media.available ? media.artist || "Unknown artist" : systemAudio ? "Visualizing Windows output" : "Choose music from your PC"}
          </div>
          <MusicLibraryControls media={media} library={library} />
        </div>
        <Transport media={media} busy={library.busy} onAction={onAction} />
      </div>

      <div className="hover-bottom">
        <ProgressBar
          positionMs={positionMs}
          durationMs={media.durationMs}
          enabled={media.available && media.canSeek}
          showTimes={media.durationMs > 0}
          onSeek={onSeek}
        />
        <MiniVisualizer visualizer={visualizer} playing={media.playing} />
      </div>
    </div>
  );
}
