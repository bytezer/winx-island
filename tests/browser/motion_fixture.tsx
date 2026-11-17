import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SpectrumBars } from "../../src/island/Waveform";
import { DEFAULT_THEME } from "../../src/lib/theme";

const samples: Record<string, [number, number][]> = { smooth: [], segmented: [], dots: [] };
Object.assign(window, { motionProbe: { samples, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches } });
const fillRectangle = CanvasRenderingContext2D.prototype.fillRect;
CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
  const style = this.canvas.closest<HTMLElement>(".waveform")?.dataset.style;
  if (x === 0 && height === 1.5 && style && samples[style].length < 900) samples[style].push([performance.now(), y]);
  fillRectangle.call(this, x, y, width, height);
};

function MotionFixture() {
  const [bands, setBands] = useState(Array(7).fill(0));
  useEffect(() => {
    const start = performance.now();
    const interval = setInterval(() => {
      const time = (performance.now() - start) / 1_000;
      const pulse = Math.max(0, Math.sin(time * 3));
      setBands(Array.from({ length: 7 }, (_, index) => 0.08 + 0.78 * pulse * (0.65 + 0.35 * Math.sin(time * 4 + index) ** 2)));
    }, 33);
    return () => clearInterval(interval);
  }, []);
  return <main>{(["smooth", "segmented", "dots"] as const).map(barStyle => <section key={barStyle}>
    <p>{barStyle}</p>
    <SpectrumBars bands={bands} playing visualizer theme={{ ...DEFAULT_THEME, barStyle, peakEnabled: true, peakHoldMs: 0, peakGravity: 400 }} />
  </section>)}</main>;
}

createRoot(document.getElementById("root")!).render(<MotionFixture />);
