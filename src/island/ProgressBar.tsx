import { useCallback, useRef } from "react";
import { formatDuration } from "../lib/format";

interface ProgressBarProps {
  positionMs: number;
  durationMs: number;
  enabled: boolean;
  showTimes?: boolean;
  onSeek: (positionMs: number) => void;
}

export function ProgressBar({ positionMs, durationMs, enabled, showTimes, onSeek }: ProgressBarProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      if (!rail || !enabled || durationMs <= 0) return;
      const bounds = rail.getBoundingClientRect();
      const localRatio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
      onSeek(localRatio * durationMs);
    },
    [durationMs, enabled, onSeek],
  );

  return (
    <div className={`progress-block ${enabled ? "" : "is-disabled"}`}>
      <div
        ref={railRef}
        className="progress-rail"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-valuenow={Math.round(positionMs / 1000)}
        tabIndex={-1}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (!enabled) return;
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          seekFromEvent(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1 && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            seekFromEvent(event.clientX);
          }
        }}
      >
        <div className="progress-fill" style={{ width: `${ratio * 100}%` }}>
          <div className="progress-knob" />
        </div>
      </div>
      {showTimes && (
        <div className="progress-times">
          <span>{formatDuration(positionMs)}</span>
          <span>{formatDuration(durationMs)}</span>
        </div>
      )}
    </div>
  );
}
