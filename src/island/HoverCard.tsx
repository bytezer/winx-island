import { MusicLibraryControls, MediaSourceControls } from "./MusicLibraryControls";
import { useLevel, useSpectrum } from "../hooks/useLevel";
import { useT } from "../i18n/LocaleContext";
import { useThemeContext } from "../hooks/useThemeContext";
import { AUDIO_NOISE_FLOOR } from "../lib/visualizer";
import type { MediaAction, MediaSnapshot, MusicLibraryActions } from "../types";
import { CoverArt } from "./CoverArt";
import { ProgressBar } from "./ProgressBar";
import { SpectrumBars } from "./Waveform";
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
  const t = useT();
  const systemAudio = useLevel() > AUDIO_NOISE_FLOOR && visualizer;
  const bands = useSpectrum();
  const theme = useThemeContext();
  return (
    <div className="hover-card">
      <div className="hover-main">
        <CoverArt src={media.art} size={78} radius={16} />
        <div className="meta">
          <div className="meta-title">{media.available ? media.title || t("island.media.unknown_track") : systemAudio ? t("island.media.system_audio") : media.sourceSelection ? t("island.media.apps_title") : t("island.media.empty_title")}</div>
          <div className="meta-sub">
            {media.available ? media.artist || t("island.media.unknown_artist") : systemAudio ? t("island.media.visualizing") : media.sourceSelection ? t("island.media.apps_hint_short") : t("island.media.empty_hint")}
          </div>
          <MusicLibraryControls media={media} library={library} showSources={false} />
        </div>
        <Transport media={media} busy={library.busy} onAction={onAction} />
      </div>

      <MediaSourceControls media={media} library={library} />
      <div className="hover-bottom">
        <ProgressBar
          positionMs={positionMs}
          durationMs={media.durationMs}
          enabled={media.available && media.canSeek}
          showTimes={media.durationMs > 0}
          onSeek={onSeek}
        />
        <SpectrumBars bands={bands} theme={theme} bars={12} visualizer={visualizer} playing={media.playing} />
      </div>
    </div>
  );
}
