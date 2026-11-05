import { invoke } from "@tauri-apps/api/core";
import type { MediaAction, MediaSnapshot, PanelTab, Shortcut } from "../types";
import { changePanelTab, changeVisualizer, openSettings } from "../hooks/useSettings";
import { SettingsIcon } from "./icons";
import { CoverArt } from "./CoverArt";
import { MiniVisualizer } from "./MiniVisualizer";
import { ProgressBar } from "./ProgressBar";
import { ShortcutTile } from "./ShortcutTile";
import { Transport } from "./Transport";

interface PanelProps {
  media: MediaSnapshot;
  positionMs: number;
  panelTab: PanelTab;
  shortcuts: Shortcut[];
  visualizer: boolean;
  onAction: (action: MediaAction) => void;
  onSeek: (positionMs: number) => void;
  onTab: (tab: PanelTab) => void;
}

interface PanelViewProps {
  media: MediaSnapshot;
  positionMs: number;
  visualizer: boolean;
  onAction: (action: MediaAction) => void;
  onSeek: (positionMs: number) => void;
}

function MediaPanel({ media, positionMs, visualizer, onAction, onSeek }: PanelViewProps) {
  return (
    <div className="panel-media">
      <div className="panel-header">
        <CoverArt src={media.art} size={96} radius={18} />
        <div className="meta">
          <div className="badge-row">
            <div className="badge">
              <span className={`badge-dot ${media.playing ? "is-live" : ""}`} />
              {media.available ? (media.playing ? "Playing" : "Paused") : "Idle"}
            </div>
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
        showTimes={media.durationMs > 0}
        onSeek={onSeek}
      />

      <div className="panel-transport">
        <Transport media={media} large onAction={onAction} />
        <MiniVisualizer visualizer={visualizer} playing={media.playing} />
      </div>
    </div>
  );
}

interface ShortcutsPanelProps {
  shortcuts: Shortcut[];
}

function ShortcutsPanel({ shortcuts }: ShortcutsPanelProps) {
  return (
    <div className="panel-shortcuts">
      <div className="shortcuts-head">
        <span className="shortcuts-title">Shortcuts</span>
        <span className="shortcuts-hint">
          {shortcuts.length > 0
            ? `${shortcuts.length} defined in settings.yaml`
            : "No shortcuts defined in settings.yaml"}
        </span>
      </div>
      <div className="shortcuts-grid">
        {shortcuts.map((shortcut) => (
          <ShortcutTile
            key={shortcut.id}
            shortcut={shortcut}
            onOpened={() => changePanelTab("media")}
          />
        ))}
      </div>
    </div>
  );
}

export function Panel({
  media,
  positionMs,
  panelTab,
  shortcuts,
  visualizer,
  onAction,
  onSeek,
  onTab,
}: PanelProps) {
  return (
    <div className="panel">
      {media.art && <div className="panel-backdrop" style={{ backgroundImage: `url(${media.art})` }} />}

      <div
        className="panel-tabs"
        role="tablist"
        aria-label="Panel sections"
      >
        <button
          type="button"
          className={panelTab === "media" ? "is-active" : ""}
          onClick={(event) => {
            event.stopPropagation();
            if (panelTab !== "media") {
              onTab("media");
              void changePanelTab("media");
            }
          }}
        >
          Media
        </button>
        <button
          type="button"
          className={panelTab === "shortcuts" ? "is-active" : ""}
          onClick={(event) => {
            event.stopPropagation();
            if (panelTab !== "shortcuts") {
              onTab("shortcuts");
              void changePanelTab("shortcuts");
            }
          }}
        >
          Shortcuts
        </button>
      </div>

      {panelTab === "media" ? (
        <MediaPanel
          media={media}
          positionMs={positionMs}
          visualizer={visualizer}
          onAction={onAction}
          onSeek={onSeek}
        />
      ) : (
        <ShortcutsPanel shortcuts={shortcuts} />
      )}

      <div className="panel-footer">
        <span className="wordmark">winx-island</span>
        <div className="footer-actions">
          <button
            type="button"
            className="ghost-button icon-only"
            aria-label="Open settings"
            title="Open settings"
            onClick={(event) => {
              event.stopPropagation();
              void openSettings();
            }}
          >
            <SettingsIcon size={14} />
          </button>
          <button
            type="button"
            className="toggle-button"
            aria-pressed={visualizer}
            onClick={(event) => {
              event.stopPropagation();
              void changeVisualizer(!visualizer);
            }}
          >
            <span className={`badge-dot ${visualizer ? "is-live" : ""}`} />
            Visualizer {visualizer ? "On" : "Off"}
          </button>
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
    </div>
  );
}
