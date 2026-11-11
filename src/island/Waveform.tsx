import { useSpectrum } from "../hooks/useLevel";
import { useTheme } from "../hooks/useTheme";
import { useSpectrumCanvas } from "../hooks/useSpectrumAnimation";
import { DEFAULT_THEME } from "../lib/theme";
import { SPECTRUM_HEIGHT } from "../lib/spectrum-renderer";
import type { ThemeSettings } from "../types";

interface WaveformProps {
  playing: boolean;
  visualizer: boolean;
  bars?: number;
}

interface SpectrumBarsProps extends WaveformProps {
  bands: readonly number[];
  theme?: ThemeSettings;
}

export function SpectrumBars({ bands, playing, visualizer, bars = 7, theme = DEFAULT_THEME }: SpectrumBarsProps) {
  const canvas = useSpectrumCanvas(bands, theme, playing, visualizer, bars);
  const width = bars * 4 + Math.max(0, bars - 1) * 2;
  return (
    <div className={`waveform ${playing ? "is-playing" : ""} ${visualizer ? "is-peak" : ""}`} data-style={theme.barStyle} aria-hidden="true" style={{ width }}>
      <canvas ref={canvas} width={width} height={SPECTRUM_HEIGHT} />
    </div>
  );
}

export function Waveform(props: WaveformProps) {
  const bands = useSpectrum();
  const theme = useTheme();
  return <SpectrumBars {...props} bands={bands} theme={theme} />;
}
