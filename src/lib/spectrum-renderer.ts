import { advancePeaks } from "./peaks";
import type { PeakState } from "./peaks";
import { barPaint } from "./theme";
import type { ThemeSettings } from "../types";

export const SPECTRUM_WIDTH = 40;
export const SPECTRUM_HEIGHT = 28;

export interface SpectrumFrame {
  bars: number[];
  barVelocities?: number[];
  peaks: PeakState[];
}

export interface SpectrumAnimation {
  frame: SpectrumFrame;
  timestamp: number;
}

function bounded(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function createSpectrumAnimation(): SpectrumAnimation {
  return { frame: { bars: [], peaks: [] }, timestamp: 0 };
}

export function advanceSpectrumFrame(previous: SpectrumFrame, input: readonly number[], delta: number, theme: ThemeSettings, peaksEnabled: boolean, reducedMotion = false): SpectrumFrame {
  const target = input.map(bounded);
  const elapsed = Number.isFinite(delta) ? Math.max(0, delta) : 0;
  const reset = previous.bars.length !== target.length || elapsed > 0.25;
  const barVelocities: number[] = [];
  const bars = target.map((level, index) => {
    if (reset || reducedMotion) {
      barVelocities.push(0);
      return level;
    }
    const old = previous.bars[index];
    const velocity = previous.barVelocities?.[index] ?? 0;
    const frequency = 60;
    const error = old - level;
    const impulse = velocity + frequency * error;
    const decay = Math.exp(-frequency * elapsed);
    const next = bounded(level + (error + impulse * elapsed) * decay);
    const nextVelocity = (velocity - frequency * impulse * elapsed) * decay;
    const settled = level === 0 && next < 0.001 && Math.abs(nextVelocity) < 0.01;
    barVelocities.push(settled || next === 0 || next === 1 ? 0 : nextVelocity);
    return settled ? 0 : next;
  });
  const peaks = !peaksEnabled ? [] : reducedMotion
    ? bars.map((height) => ({ height, velocity: 0, holdRemaining: 0 }))
    : advancePeaks(reset ? [] : previous.peaks, bars, reset ? 0 : elapsed, theme.peakHoldMs, theme.peakGravity, barVelocities);
  return { bars, barVelocities, peaks };
}

export function spectrumGeometry(width: number, height: number, count: number, peaksEnabled: boolean) {
  const baseline = Math.max(0, height - 1);
  const maximum = Math.max(3, height - (peaksEnabled ? 6 : 4));
  return { baseline, maximum, cellWidth: count > 0 ? (width - (count - 1) * 2) / count : 0 };
}

function fillColor(context: CanvasRenderingContext2D, theme: ThemeSettings, index: number, count: number, baseline: number, maximum: number, height: number) {
  if (theme.colorMode === "solid") return theme.solidColor;
  const vertical = theme.colorMode === "gradient" && theme.gradientDirection === "vertical";
  const gradient = context.createLinearGradient(0, baseline, 0, baseline - (vertical ? maximum : height));
  if (vertical) {
    gradient.addColorStop(0, theme.gradientStart);
    gradient.addColorStop(0.5, theme.gradientMiddle);
    gradient.addColorStop(1, theme.gradientEnd);
  } else {
    const paint = barPaint(theme, index, count);
    gradient.addColorStop(0, paint.base);
    gradient.addColorStop(1, paint.tip);
  }
  return gradient;
}

export function drawSpectrum(context: CanvasRenderingContext2D, width: number, height: number, frame: SpectrumFrame, theme: ThemeSettings, peaksEnabled: boolean) {
  context.clearRect(0, 0, width, height);
  const count = frame.bars.length;
  const geometry = spectrumGeometry(width, height, count, peaksEnabled);
  const signal = frame.bars.some((level) => level > 0.015) || frame.peaks.some((peak) => peak.height > 0.015);
  context.globalAlpha = signal ? 1 : 0.4;
  context.shadowBlur = 0;
  for (let index = 0; index < count; index++) {
    const x = index * (geometry.cellWidth + 2);
    const barHeight = 3 + (geometry.maximum - 3) * frame.bars[index];
    const paint = barPaint(theme, index, count);
    context.shadowBlur = theme.glow ? 1 : 0;
    context.shadowColor = theme.colorMode === "gradient" && theme.gradientDirection === "vertical" ? theme.gradientMiddle : paint.base;
    context.fillStyle = fillColor(context, theme, index, count, geometry.baseline, geometry.maximum, barHeight);
    if (theme.barStyle === "smooth") {
      context.beginPath();
      context.roundRect(x, geometry.baseline - barHeight, geometry.cellWidth, barHeight, Math.min(geometry.cellWidth / 2, barHeight / 2) * theme.barRoundness / 100);
      context.fill();
    } else {
      const radius = Math.min(1.1, geometry.cellWidth / 2);
      const capHeight = theme.barStyle === "dots" ? radius * 2 : 2;
      const cells = Math.max(1, Math.floor((barHeight - capHeight) / 3));
      for (let cell = 0; cell <= cells; cell++) {
        const top = cell === cells ? geometry.baseline - barHeight : geometry.baseline - cell * 3 - capHeight;
        context.beginPath();
        if (theme.barStyle === "dots") {
          context.arc(x + geometry.cellWidth / 2, top + radius, radius, 0, Math.PI * 2);
        } else {
          context.roundRect(x, top, geometry.cellWidth, 2, theme.barRoundness / 100);
        }
        context.fill();
      }
    }
    const peak = frame.peaks[index];
    if (peaksEnabled && peak && peak.height > 0.015) {
      context.fillStyle = theme.colorMode === "gradient" && theme.gradientDirection === "vertical" ? theme.gradientEnd : paint.tip;
      context.globalAlpha = Math.min(1, peak.height / 0.03);
      const peakHeight = 3 + (geometry.maximum - 3) * peak.height;
      context.fillRect(x, geometry.baseline - peakHeight - 1.5, geometry.cellWidth, 1.5);
      context.globalAlpha = signal ? 1 : 0.4;
    }
  }
  context.globalAlpha = 1;
}
