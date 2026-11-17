import { MusicLibraryControls } from "./MusicLibraryControls";
import { useLevel } from "../hooks/useLevel";
import { useT } from "../i18n/LocaleContext";
import { AUDIO_NOISE_FLOOR } from "../lib/visualizer";
import { invoke } from "@tauri-apps/api/core";
import type { MediaAction, MediaSnapshot, MusicLibraryActions, PanelTab, Shortcut } from "../types";
import { changePanelTab, changeVisualizer, openAppearanceEditor, openSettings } from "../hooks/useSettings";
import { GearIcon, SettingsIcon } from "./icons";
import { CoverArt } from "./CoverArt";
import { MiniVisualizer } from "./MiniVisualizer";
import { ProgressBar } from "./ProgressBar";
import { ShortcutTile } from "./ShortcutTile";
import { Transport } from "./Transport";

interface PanelProps {
  media: MediaSnapshot;
  library: MusicLibraryActions;
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
  library: MusicLibraryActions;
  positionMs: number;
  visualizer: boolean;
  onAction: (action: MediaAction) => void;
  onSeek: (positionMs: number) => void;
}

function MediaPanel({ media, library, positionMs, visualizer, onAction, onSeek }: PanelViewProps) {
  const t = useT();
  const systemAudio = useLevel() > AUDIO_NOISE_FLOOR && visualizer;
  return (
    <div className="panel-media">
      <div className="panel-header">
        <CoverArt src={media.art} size={96} radius={18} />
        <div className="meta">
          <div className="badge-row">
            <div className="badge">
              <span className={`badge-dot ${media.playing || systemAudio ? "is-live" : ""}`} />
              {media.available ? (media.playing ? t("island.media.playing") : t("island.media.paused")) : systemAudio ? t("island.media.system_audio") : t("island.media.idle")}
            </div>
          </div>
          <div className="panel-title">{media.available ? media.title || t("island.media.unknown_track") : systemAudio ? t("island.media.system_audio") : media.sourceSelection ? t("island.media.apps_title") : t("island.media.empty_title")}</div>
          <div className="meta-sub">{media.available ? media.artist || t("island.media.unknown_artist") : systemAudio ? t("island.media.visualizing") : media.sourceSelection ? t("island.media.apps_hint") : t("island.media.empty_hint")}</div>
        </div>
      </div>

      <MusicLibraryControls media={media} library={library} />

      <ProgressBar
        positionMs={positionMs}
        durationMs={media.durationMs}
        enabled={media.available && media.canSeek}
        showTimes={media.durationMs > 0}
        onSeek={onSeek}
      />

      <div className="panel-transport">
        <Transport media={media} busy={library.busy} large onAction={onAction} />
        <MiniVisualizer visualizer={visualizer} playing={media.playing} />
      </div>
    </div>
  );
}

interface ShortcutsPanelProps {
  shortcuts: Shortcut[];
}

function ShortcutsPanel({ shortcuts }: ShortcutsPanelProps) {
  const t = useT();
  return (
    <div className="panel-shortcuts">
      <div className="shortcuts-head">
        <span className="shortcuts-title">{t("island.panel.tab_shortcuts")}</span>
        <span className="shortcuts-hint">
          {shortcuts.length > 0
            ? t("island.panel.shortcuts_defined", { count: shortcuts.length })
            : t("island.panel.no_shortcuts")}
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
  library,
  positionMs,
  panelTab,
  shortcuts,
  visualizer,
  onAction,
  onSeek,
  onTab,
}: PanelProps) {
  const t = useT();
  return (
    <div className="panel">
      {media.art && <div className="panel-backdrop" style={{ backgroundImage: `url(${media.art})` }} />}

      <div
        className="panel-tabs"
        role="tablist"
        aria-label={t("island.panel.tabs_group")}
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
          {t("island.panel.tab_media")}
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
          {t("island.panel.tab_shortcuts")}
        </button>
      </div>

      {panelTab === "media" ? (
        <MediaPanel
          media={media}
          library={library}
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
            aria-label={t("island.panel.customize")}
            title={t("island.panel.customize")}
            onClick={(event) => {
              event.stopPropagation();
              void openAppearanceEditor();
            }}
          >
            <SettingsIcon size={14} />
          </button>
          <button
            type="button"
            className="ghost-button icon-only"
            aria-label={t("island.panel.open_settings")}
            title={t("island.panel.open_settings")}
            onClick={(event) => {
              event.stopPropagation();
              void openSettings();
            }}
          >
            <GearIcon size={14} />
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
            {visualizer ? t("island.panel.visualizer_on") : t("island.panel.visualizer_off")}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={(event) => {
              event.stopPropagation();
              void invoke("quit_app");
            }}
          >
            {t("island.panel.quit")}
          </button>
        </div>
      </div>
    </div>
  );
}
