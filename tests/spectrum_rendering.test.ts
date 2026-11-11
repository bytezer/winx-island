import assert from "node:assert/strict";
import test from "node:test";
import { advanceSpectrumFrame, drawSpectrum } from "../src/lib/spectrum-renderer";
import { DEFAULT_THEME } from "../src/lib/theme";
import { SpectrumContext } from "./helpers/spectrum-context";

const theme = { ...DEFAULT_THEME, peakEnabled: true, peakHoldMs: 0, peakGravity: 400 };

test("DRAW-01: every bar and peak stays inside the surface at minimum and normal height", () => {
  for (const style of ["smooth", "segmented", "dots"] as const) {
    for (const height of [24, 26, 28]) {
      const painter = new SpectrumContext();
      const frame = advanceSpectrumFrame({ bars: [], peaks: [] }, [1, 0.8, 1, 0.5, 0.2, 1, 0.9], 1, theme, true);
      drawSpectrum(painter.context(), 40, height, frame, { ...theme, barStyle: style }, true);
      for (const shape of painter.rectangles) {
        assert.ok(shape.x >= 0 && shape.y >= 0 && shape.x + shape.width <= 40 && shape.y + shape.height <= height);
      }
      for (const circle of painter.circles) assert.ok(circle.y - circle.radius >= 0 && circle.y + circle.radius <= height);
    }
  }
});

test("DRAW-02: bars and markers share the same smooth frame even with instant hold and fast fall", () => {
  let frame = advanceSpectrumFrame({ bars: [], peaks: [] }, [0.9], 1, theme, true);
  let previous = frame.bars[0];
  for (let index = 0; index < 30; index++) {
    frame = advanceSpectrumFrame(frame, [0.1], 1 / 60, theme, true);
    assert.ok(frame.bars[0] <= previous && frame.peaks[0].height >= frame.bars[0]);
    assert.ok(Math.abs(frame.bars[0] - previous) < 0.3);
    previous = frame.bars[0];
  }
});

test("DRAW-03: returning after a suspended frame does not revive an old frozen peak", () => {
  const old = advanceSpectrumFrame({ bars: [], peaks: [] }, [0.9], 1, theme, true);
  const returned = advanceSpectrumFrame(old, [0], 3, theme, true);
  assert.equal(returned.bars[0], 0);
  assert.equal(returned.peaks[0].height, 0);
});

test("DRAW-04: reduced motion skips the extra falling animation", () => {
  const old = advanceSpectrumFrame({ bars: [], peaks: [] }, [0.9], 1, theme, true);
  const reduced = advanceSpectrumFrame(old, [0.2], 0.016, theme, true, true);
  assert.equal(reduced.bars[0], 0.2);
  assert.equal(reduced.peaks[0].height, 0.2);
});

test("CONTACT-01: a caught marker touches the painted top of each bar style", () => {
  for (const barStyle of ["smooth", "segmented", "dots"] as const) {
    for (const level of [0.2, 0.53, 1]) {
      const painter = new SpectrumContext();
      const frame = advanceSpectrumFrame({ bars: [], peaks: [] }, [level], 1, theme, true);
      drawSpectrum(painter.context(), 4, 28, frame, { ...theme, barStyle }, true);
      const peak = painter.rectangles.find(shape => shape.kind === "peak")!;
      const barTop = barStyle === "dots"
        ? Math.min(...painter.circles.map(shape => shape.y - shape.radius))
        : Math.min(...painter.rectangles.filter(shape => shape.kind === "bar").map(shape => shape.y));
      assert.ok(Math.abs(peak.y + peak.height - barTop) < 0.001, `${barStyle}: visible gap above bar`);
    }
  }
});

test("FLUID-01: free markers move continuously across segmented and dotted cell boundaries", () => {
  for (const barStyle of ["smooth", "segmented", "dots"] as const) {
    const tops: number[] = [];
    for (let step = 0; step < 30; step++) {
      const painter = new SpectrumContext();
      drawSpectrum(painter.context(), 4, 28, { bars: [0.1], peaks: [{ height: 0.8 - step * 0.004, velocity: 0.2, holdRemaining: 0 }] }, { ...theme, barStyle }, true);
      tops.push(painter.rectangles.find(shape => shape.kind === "peak")!.y);
    }
    for (let step = 1; step < tops.length; step++) {
      assert.ok(tops[step] > tops[step - 1] && tops[step] - tops[step - 1] < 0.1, `${barStyle}: marker snapped or stalled`);
    }
  }
});

test("FLUID-02: abrupt energy starts with acceleration while remaining responsive", () => {
  let frame = advanceSpectrumFrame({ bars: [], peaks: [] }, [0], 1, theme, true);
  frame = advanceSpectrumFrame(frame, [1], 1 / 60, theme, true);
  const first = frame.bars[0];
  frame = advanceSpectrumFrame(frame, [1], 1 / 60, theme, true);
  assert.ok(first > 0 && first < 0.4);
  assert.ok(frame.bars[0] - first > first);
  assert.ok(frame.peaks[0].height >= frame.bars[0]);
});

test("FLUID-05: bar damping is independent of frame rate", () => {
  const finals = [30, 60, 120].map(rate => {
    let frame = advanceSpectrumFrame({ bars: [], peaks: [] }, [0], 1, theme, true);
    for (let step = 0; step < rate / 2; step++) frame = advanceSpectrumFrame(frame, [1], 1 / rate, theme, true);
    for (let step = 0; step < rate / 2; step++) frame = advanceSpectrumFrame(frame, [0.2], 1 / rate, theme, true);
    return frame;
  });
  for (const frame of finals) assert.ok(Math.abs(frame.bars[0] - finals[0].bars[0]) < 1e-9);
});

test("IMPACT-01: bars follow a beat within 50 ms independently of airborne peaks", () => {
  let frame = advanceSpectrumFrame({ bars: [], peaks: [] }, [0], 1, theme, true);
  for (let step = 0; step < 6; step++) frame = advanceSpectrumFrame(frame, [1], 1 / 120, theme, true);
  assert.ok(frame.bars[0] > 0.75, `late attack: ${frame.bars[0]}`);
  for (let step = 0; step < 12; step++) frame = advanceSpectrumFrame(frame, [0], 1 / 120, theme, true);
  assert.ok(frame.bars[0] < 0.05, `late release: ${frame.bars[0]}`);
});

test("IMPACT-05: airborne markers retain headroom above fully raised bars", () => {
  for (const barStyle of ["smooth", "segmented", "dots"] as const) {
    for (const height of [24, 26, 28]) {
      const painter = new SpectrumContext();
      drawSpectrum(painter.context(), 4, height, { bars: [1], peaks: [{ height: 1.12, velocity: 0, holdRemaining: 0 }] }, { ...theme, barStyle }, true);
      const peak = painter.rectangles.find(shape => shape.kind === "peak")!;
      assert.ok(peak.y >= 0 && peak.y + peak.height <= height);
      const barTop = height - 1 - (height - 6);
      assert.ok(peak.y + peak.height < barTop);
    }
  }
});
