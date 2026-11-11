import { createContext, useContext, useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { advanceSpectrumFrame, createSpectrumAnimation, drawSpectrum, SPECTRUM_HEIGHT } from "../lib/spectrum-renderer";
import type { SpectrumAnimation } from "../lib/spectrum-renderer";
import type { ThemeSettings } from "../types";

export const SpectrumAnimationContext = createContext<RefObject<SpectrumAnimation> | null>(null);
export const SpectrumActiveContext = createContext(true);

export function useSpectrumCanvas(bands: readonly number[], theme: ThemeSettings, playing: boolean, visualizer: boolean, count: number) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const local = useRef(createSpectrumAnimation());
  const shared = useContext(SpectrumAnimationContext);
  const active = useContext(SpectrumActiveContext);
  const model = shared ?? local;
  const target = useRef({ bands, theme, playing, visualizer });
  useLayoutEffect(() => { target.current = { bands, theme, playing, visualizer }; }, [bands, theme, playing, visualizer]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !active) return;
    const context = element.getContext("2d", { alpha: true, willReadFrequently: true });
    if (!context) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let request = 0;
    const logicalWidth = count * 4 + Math.max(0, count - 1) * 2;
    function render(now: number) {
      if (!element || !context) return;
      const current = target.current;
      const height = Math.min(SPECTRUM_HEIGHT, element.clientHeight || SPECTRUM_HEIGHT);
      const bounds = element.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio * bounds.width / logicalWidth);
      const pixelWidth = Math.round(logicalWidth * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (element.width !== pixelWidth || element.height !== pixelHeight) {
        element.width = pixelWidth;
        element.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const input = Array.from({ length: count }, (_, index) => current.visualizer
        ? current.bands[index] ?? 0
        : current.playing ? 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(now / (145 + index * 11) + index)) : 0);
      const peaksEnabled = current.visualizer && current.theme.peakEnabled;
      const delta = model.current.timestamp ? (now - model.current.timestamp) / 1_000 : 1;
      model.current.frame = advanceSpectrumFrame(model.current.frame, input, delta, current.theme, peaksEnabled, preference.matches);
      model.current.timestamp = now;
      drawSpectrum(context, logicalWidth, height, model.current.frame, current.theme, peaksEnabled);
      request = requestAnimationFrame(render);
    }
    request = requestAnimationFrame(render);
    return () => cancelAnimationFrame(request);
  }, [active, count, model]);

  return canvas;
}
