import { useCallback, useRef, useState } from "react";
import { useT } from "../i18n/LocaleContext";
import { formatDuration } from "../lib/format";

interface ProgressBarProps {
  positionMs: number;
  durationMs: number;
  enabled: boolean;
  showTimes?: boolean;
  onSeek: (positionMs: number) => void;
}

export function ProgressBar({ positionMs, durationMs, enabled, showTimes, onSeek }: ProgressBarProps) {
  const t = useT();
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [draft, setDraft] = useState<number | null>(null);
  const displayPosition = draft ?? positionMs;
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, displayPosition / durationMs)) : 0;

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      if (!rail || !enabled || durationMs <= 0) return;
      const bounds = rail.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const localRatio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
      setDraft(localRatio * durationMs);
    },
    [durationMs, enabled, onSeek],
  );

  return (
    <div className={`progress-block ${enabled ? "" : "is-disabled"}`} onClick={(event) => event.stopPropagation()}>
      <div
        ref={railRef}
        className="progress-rail"
        role="slider"
        aria-label={t("island.seek")}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-valuenow={Math.round(displayPosition / 1000)}
        tabIndex={-1}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          if (!enabled) return;
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          seekFromEvent(event.clientX);
        }}
        onPointerMove={(event) => {
          if (dragging.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
            seekFromEvent(event.clientX);
          }
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (!dragging.current) return;
          dragging.current = false;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (enabled && durationMs > 0 && bounds.width > 0) onSeek(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) * durationMs);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setDraft(null);
        }}
        onPointerCancel={() => { dragging.current = false; setDraft(null); }}
        onLostPointerCapture={() => { dragging.current = false; setDraft(null); }}
      >
        <div className="progress-fill" style={{ width: `${ratio * 100}%` }}>
          <div className="progress-knob" />
        </div>
      </div>
      {showTimes && (
        <div className="progress-times">
          <span>{formatDuration(displayPosition)}</span>
          <span>{formatDuration(durationMs)}</span>
        </div>
      )}
    </div>
  );
}
