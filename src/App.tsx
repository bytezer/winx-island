import { SpectrumAnimationContext, SpectrumActiveContext } from "./hooks/useSpectrumAnimation";
import { createSpectrumAnimation } from "./lib/spectrum-renderer";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ThemeContext } from "./hooks/useTheme";
import { normalizeTheme, themeVariables, themeAccent } from "./lib/theme";
import { layoutFor } from "./lib/layout";
import { extractAccent } from "./lib/accent";
import { formatClock } from "./lib/format";
import { useSettings } from "./hooks/useSettings";
import { useMedia, usePlayhead } from "./hooks/useMedia";
import { useInteractiveRect, usePointerInside } from "./hooks/usePointer";
import type { PanelTab, View } from "./types";
import { CompactPill } from "./island/CompactPill";
import { HoverCard } from "./island/HoverCard";
import { Panel } from "./island/Panel";

/**
 * Debug helper: WINX_START_VIEW=hover|panel freezes the island in that state so
 * screenshots and layout checks are deterministic. Pointer tracking is disabled
 * while it is set.
 */
const forcedView: View | undefined = (() => {
  const value = (window as unknown as { __winxStartView?: string }).__winxStartView;
  return value === "compact" || value === "hover" || value === "panel" ? value : undefined;
})();

/** Debug helper: freezes the panel tab (WINX_START_TAB=media|shortcuts). */
const forcedPanelTab: PanelTab | undefined = (() => {
  const value = (window as unknown as { __winxStartTab?: string }).__winxStartTab;
  return value === "media" || value === "shortcuts" ? value : undefined;
})();

export default function App() {
  const spectrumAnimation = useRef(createSpectrumAnimation());
  const { media, receivedAt, library, onAction, onSeek } = useMedia();
  const { visualizerEnabled, appearance, theme: savedTheme, lastPanelTab, shortcuts } = useSettings();
  const theme = useMemo(() => normalizeTheme(savedTheme), [savedTheme]);
  const inside = usePointerInside();
  const [view, setView] = useState<View>(forcedView ?? "compact");
  const [accent, setAccent] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [panelTab, setPanelTab] = useState<PanelTab>(forcedPanelTab ?? lastPanelTab);

  const layout = useMemo(() => {
    const sizes = layoutFor(appearance, theme.islandRoundness);
    return library.error ? { ...sizes, hover: { ...sizes.hover, height: sizes.hover.height + 44 } } : sizes;
  }, [appearance, theme.islandRoundness, library.error]);
  useInteractiveRect(view, layout);

  useEffect(() => {
    if (media.available) return;
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(interval);
  }, [media.available]);

  useEffect(() => {
    if (forcedView) return;
    if (!inside) {
      const timeout = window.setTimeout(() => setView("compact"), 260);
      return () => window.clearTimeout(timeout);
    }
    setView((current) => (current === "compact" ? "hover" : current));
  }, [inside]);

  useEffect(() => {
    if (!media.art) {
      setAccent(null);
      return;
    }
    let active = true;
    void extractAccent(media.art).then((value) => {
      if (active) setAccent(value);
    });
    return () => {
      active = false;
    };
  }, [media.art]);

  const positionMs = usePlayhead(media, receivedAt, view !== "compact");

  const onTab = useCallback((tab: PanelTab) => {
    setPanelTab(tab);
  }, []);

  const togglePanel = useCallback(() => {
    setView((current) => (current === "panel" ? "hover" : "panel"));
  }, []);

  useEffect(() => {
    if (!forcedPanelTab) setPanelTab(lastPanelTab);
  }, [lastPanelTab]);

  const box = layout[view];
  const clock = useMemo(() => formatClock(now), [now]);

  return (
    <ThemeContext.Provider value={theme}>
    <SpectrumAnimationContext.Provider value={spectrumAnimation}>
    <div className="canvas">
      <div
        className="island"
        data-view={view}
        style={{
          width: box.width,
          height: box.height,
          borderRadius: box.radius,
          ...themeVariables(theme, view),
          ["--accent" as string]: themeAccent(theme, accent ?? undefined),
        }}
        onClick={togglePanel}
        onPointerDown={(event) => {
          if (event.button === 2) {
            event.preventDefault();
            void invoke("begin_drag");
          }
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="glow" />

        <div className="layer" data-active={view === "compact"}>
          <SpectrumActiveContext.Provider value={view === "compact"}>
          <CompactPill media={media} clock={clock} visualizer={visualizerEnabled} />
          </SpectrumActiveContext.Provider>
        </div>

        <div className="layer" data-active={view === "hover"}>
          <SpectrumActiveContext.Provider value={view === "hover"}>
          <HoverCard
            media={media}
            library={library}
            positionMs={positionMs}
            visualizer={visualizerEnabled}
            onAction={onAction}
            onSeek={onSeek}
          />
          </SpectrumActiveContext.Provider>
        </div>

        <div className="layer" data-active={view === "panel"}>
          <SpectrumActiveContext.Provider value={view === "panel"}>
          <Panel
            media={media}
            library={library}
            positionMs={positionMs}
            panelTab={panelTab}
            shortcuts={shortcuts}
            visualizer={visualizerEnabled}
            onAction={onAction}
            onSeek={onSeek}
            onTab={onTab}
          />
          </SpectrumActiveContext.Provider>
        </div>
      </div>
    </div>
    </SpectrumAnimationContext.Provider>
    </ThemeContext.Provider>
  );
}
