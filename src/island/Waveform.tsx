import { useLevel } from "../hooks/useLevel";

const ENVELOPE = [0.55, 1, 0.7, 0.95];

interface WaveformProps {
  playing: boolean;
  visualizer: boolean;
  bars?: number;
}

/**
 * The compact pill indicator. Peak-meter driven while playing with the
 * visualizer on; falls back to the procedural wave otherwise.
 */
export function Waveform({ playing, visualizer, bars = 4 }: WaveformProps) {
  const level = useLevel();
  const peak = visualizer && playing;

  return (
    <div className={`waveform ${playing ? "is-playing" : ""} ${peak ? "is-peak" : ""}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, index) => {
        const style = peak
          ? { height: `${2 + 16 * ENVELOPE[index % ENVELOPE.length] * Math.pow(level, 0.7)}px` }
          : undefined;
        return (
          <span
            key={index}
            style={style}
          />
        );
      })}
    </div>
  );
}
