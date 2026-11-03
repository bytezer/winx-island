import { invoke } from "@tauri-apps/api/core";
import type { MediaSnapshot } from "../types";
import { readableSourceApp } from "../lib/format";
import { CoverArt } from "./CoverArt";
import { ProgressBar } from "./ProgressBar";
import { Transport } from "./Transport";

interface PanelProps {
  media: MediaSnapshot;
  positionMs: number;
  onAction: (action: "play_pause" | "next" | "prev") => void;
  onSeek: (positionMs: number) => void;
}

export function Panel({ media, positionMs, onAction, onSeek }: PanelProps) {
  const source = readableSourceApp(media.sourceApp);

  return (
    <div className="panel">
      {media.art && <div className="panel-backdrop" style={{ backgroundImage: `url(${media.art})` }} />}

      <div className="panel-header">
        <CoverArt src={media.art} size={96} radius={18} />
        <div className="meta">
          <div className="badge-row">
            <div className="badge">
              <span className={`badge-dot ${media.playing ? "is-live" : ""}`} />
              {media.available ? (media.playing ? "Playing" : "Paused") : "Idle"}
            </div>
            {source && <span className="source-pill">{source}</span>}
          </div>
          <div className="panel-title">{media.available ? media.title || "Unknown track" : "Nothing playing"}</div>
          <div className="meta-sub">{media.available ? media.artist || "Unknown artist" : "Open any player to begin"}</div>
          {media.album && <div className="meta-album">{media.album}</div>}
        </div>
      </div>

      <ProgressBar
        positionMs={positionMs}
        durationMs={media.durationMs}
        enabled={media.available && media.canSeek}
        showTimes
        onSeek={onSeek}
      />

      <div className="panel-transport">
        <Transport media={media} large onAction={onAction} />
      </div>

      <div className="panel-footer">
        <span className="wordmark">winx-island</span>
        <button
          type="button"
          className="ghost-button"
          onClick={(event) => {
            event.stopPropagation();
            void invoke("quit_app");
          }}
        >
          Quit
        </button>
      </div>
    </div>
  );
}
