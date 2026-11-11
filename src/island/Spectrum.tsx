import { useSpectrum } from "../hooks/useSpectrum";

interface SpectrumProps {
  bars: number;
  playing: boolean;
  visualizer: boolean;
  panel?: boolean;
}

const MIN_HEIGHT = 3;
const REACH_CARD = 15;
const REACH_PANEL = 19;
/** Peak caps only have room once the strip is wide enough. */
const PEAK_CAP_MIN_BARS = 12;

/** Bars are measured in px from the baseline, with a slight perceptual curve. */
function heightFor(value: number, reach: number): number {
  return Math.max(MIN_HEIGHT, MIN_HEIGHT + reach * Math.pow(value, 0.7));
}

/**
 * Live spectrum strip for the hover card and the panel. The native side emits
 * 24 bands; this component only aggregates and draws them.
 */
export function Spectrum({ bars, playing, visualizer, panel = false }: SpectrumProps) {
  const { values, peaks } = useSpectrum(bars);

  if (!visualizer) return null;

  const reach = panel ? REACH_PANEL : REACH_CARD;
  const showPeaks = bars >= PEAK_CAP_MIN_BARS;

  return (
    <div
      className={`spectrum ${panel ? "is-panel" : ""} ${playing ? "is-playing" : ""}`}
      aria-hidden="true"
    >
      {values.map((value, index) => (
        <span key={index} className="spectrum-band">
          <span className="spectrum-bar" style={{ height: `${heightFor(value, reach)}px` }} />
          {showPeaks && (
            <span
              className="spectrum-peak"
              style={{ bottom: `${heightFor(peaks[index] ?? 0, reach)}px` }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
