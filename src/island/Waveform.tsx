import { useSpectrum } from "../hooks/useSpectrum";

interface WaveformProps {
  playing: boolean;
  visualizer: boolean;
}

const BARS = 4;

/** Live bars are measured from the baseline in px. */
function heightFor(value: number): number {
  return Math.max(2, 2 + 16 * Math.pow(value, 0.7));
}

/**
 * The compact pill indicator. Spectrum driven while playing with the visualizer
 * on; falls back to the procedural wave otherwise.
 */
export function Waveform({ playing, visualizer }: WaveformProps) {
  const { values } = useSpectrum(BARS);
  const live = visualizer && playing;

  return (
    <div className={`waveform ${playing ? "is-playing" : ""} ${live ? "is-peak" : ""}`} aria-hidden="true">
      {Array.from({ length: BARS }).map((_, index) => (
        <span
          key={index}
          style={live ? { height: `${heightFor(values[index] ?? 0)}px` } : undefined}
        />
      ))}
    </div>
  );
}
