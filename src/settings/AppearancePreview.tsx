import { SpectrumAnimationContext } from "../hooks/useSpectrumAnimation";
import { createSpectrumAnimation } from "../lib/spectrum-renderer";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { layoutFor } from "../lib/layout";
import { themeAccent, themeVariables } from "../lib/theme";
import { CoverArt } from "../island/CoverArt";
import { SpectrumBars } from "../island/Waveform";
import { Transport } from "../island/Transport";
import { ProgressBar } from "../island/ProgressBar";
import { useT } from "../i18n/LocaleContext";
import type { Appearance, MediaSnapshot, ThemeSettings, View } from "../types";

/** Demo track without its copy; the title and artist are localized in the component. */
const DEMO: Omit<MediaSnapshot, "title" | "artist"> = {
  available: true, album: "",
  playing: true, positionMs: 82_000, durationMs: 220_000,
  canNext: false, canPrev: false, canSeek: false, art: null,
  sourceApp: "winx-island.local", queueIndex: 0, queueLength: 1, playbackError: null, shuffleEnabled: false, repeatMode: "off",
};

interface AppearancePreviewProps {
  appearance: Appearance;
  theme: ThemeSettings;
  bands: readonly number[];
  view: View;
}

export function AppearancePreview({ appearance, theme, bands, view }: AppearancePreviewProps) {
  const t = useT();
  const animation = useRef(createSpectrumAnimation());
  const stage = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 350, height: 330 });
  const box = layoutFor(appearance, theme.islandRoundness)[view];
  const scale = Math.min(view === "compact" ? 1.8 : 1, (bounds.width - 48) / box.width, (bounds.height - 48) / box.height);
  const demo: MediaSnapshot = { ...DEMO, title: t("appearance_editor.demo_title"), artist: t("appearance_editor.demo_artist") };

  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setBounds({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  const visualizer = <SpectrumBars bands={bands} theme={theme} playing visualizer />;

  return (
    <SpectrumAnimationContext.Provider value={animation}>
    <div className="appearance-preview-stage" ref={stage}>
      <div
        className="island preview-island"
        data-view={view}
        style={{
          ...themeVariables(theme, view),
          "--accent": themeAccent(theme),
          width: box.width, height: box.height, borderRadius: box.radius,
          transform: `scale(${scale})`,
        } as CSSProperties}
      >
        <div className="glow" />
        {view === "compact" ? (
          <div className="compact">
            <CoverArt src={null} size={26} radius={8} />
            {visualizer}
          </div>
        ) : view === "hover" ? (
          <div className="hover-card">
            <div className="hover-main">
              <CoverArt src={null} size={78} radius={16} />
              <div className="meta">
                <div className="meta-title">{demo.title}</div>
                <div className="meta-sub">{demo.artist}</div>
              </div>
              <Transport media={demo} busy onAction={() => {}} />
            </div>
            <div className="hover-bottom">
              <ProgressBar positionMs={82_000} durationMs={220_000} enabled={false} showTimes onSeek={() => {}} />
              {visualizer}
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-media">
              <div className="panel-header">
                <CoverArt src={null} size={96} radius={18} />
                <div className="meta">
                  <div className="badge"><span className="badge-dot is-live" />{t("island.media.playing")}</div>
                  <div className="panel-title">{demo.title}</div>
                  <div className="meta-sub">{demo.artist}</div>
                </div>
              </div>
              <ProgressBar positionMs={82_000} durationMs={220_000} enabled={false} showTimes onSeek={() => {}} />
              <div className="panel-transport">
                <Transport media={demo} large busy onAction={() => {}} />
                <div className="mini-visualizer">{visualizer}</div>
              </div>
            </div>
            <div className="panel-footer"><span className="wordmark">winx-island</span></div>
          </div>
        )}
      </div>
    </div>
    </SpectrumAnimationContext.Provider>
  );
}
