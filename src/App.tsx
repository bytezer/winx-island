import { useCallback, useEffect, useMemo, useState } from "react";
import { LAYOUT } from "./lib/layout";
import { extractAccent } from "./lib/accent";
import { formatClock } from "./lib/format";
import { useSettings } from "./hooks/useSettings";
import { sendMediaAction, seekTo, useMedia, usePlayhead } from "./hooks/useMedia";
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
  const { media, receivedAt } = useMedia();
  const { visualizerEnabled, lastPanelTab, shortcuts } = useSettings();
  const inside = usePointerInside();
  const [view, setView] = useState<View>(forcedView ?? "compact");
  const [accent, setAccent] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [panelTab, setPanelTab] = useState<PanelTab>(forcedPanelTab ?? lastPanelTab);

  useInteractiveRect(view);

  // Idle clock: only ticks while the compact pill is showing nothing playing.
  useEffect(() => {
    if (media.available) return;
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(interval);
  }, [media.available]);

  // Expand on hover, collapse shortly after the pointer leaves the island.
  useEffect(() => {
    if (forcedView) return;
    if (!inside) {
      const timeout = window.setTimeout(() => setView("compact"), 260);
      return () => window.clearTimeout(timeout);
    }
    setView((current) => (current === "compact" ? "hover" : current));
  }, [inside]);

  // Keep the accent in sync with the current cover art.
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

  const onAction = useCallback((action: "play_pause" | "next" | "prev") => {
    void sendMediaAction(action);
  }, []);

  const onSeek = useCallback((value: number) => {
    void seekTo(value);
  }, []);

  const onTab = useCallback((tab: PanelTab) => {
    setPanelTab(tab);
  }, []);

  const togglePanel = useCallback(() => {
    setView((current) => (current === "panel" ? "hover" : "panel"));
  }, []);

  useEffect(() => {
    if (!forcedPanelTab) setPanelTab(lastPanelTab);
  }, [lastPanelTab]);

  const box = LAYOUT[view];
  const clock = useMemo(() => formatClock(now), [now]);

  return (
    <div className="canvas">
      <div
        className="island"
        data-view={view}
        style={{
          width: box.width,
          height: box.height,
          borderRadius: box.radius,
          // Exposed to CSS so the tint follows the artwork.
          ["--accent" as string]: accent ?? "#8a8f98",
        }}
        onClick={togglePanel}
      >
        <div className="glow" />

        <div className="layer" data-active={view === "compact"}>
          <CompactPill media={media} clock={clock} visualizer={visualizerEnabled} />
        </div>

        <div className="layer" data-active={view === "hover"}>
          <HoverCard
            media={media}
            positionMs={positionMs}
            visualizer={visualizerEnabled}
            onAction={onAction}
            onSeek={onSeek}
          />
        </div>

        <div className="layer" data-active={view === "panel"}>
          <Panel
            media={media}
            positionMs={positionMs}
            panelTab={panelTab}
            shortcuts={shortcuts}
            visualizer={visualizerEnabled}
            onAction={onAction}
            onSeek={onSeek}
            onTab={onTab}
          />
        </div>
      </div>
    </div>
  );
}
