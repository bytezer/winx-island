import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { advanceSpectrumFrame, drawSpectrum } from "../src/lib/spectrum-renderer";
import { DEFAULT_THEME } from "../src/lib/theme";
import { SpectrumContext } from "./helpers/spectrum-context";
import { Waveform } from "../src/island/Waveform";

function paint(bands: number[]) {
  const painter = new SpectrumContext();
  const frame = advanceSpectrumFrame({ bars: [], peaks: [] }, bands, 1, DEFAULT_THEME, false);
  drawSpectrum(painter.context(), 40, 28, frame, DEFAULT_THEME, false);
  return painter;
}

test("VIS-01: independent frequency bands produce bounded, different heights", () => {
  const shapes = paint([0.2, 0.8, 0.1, 0.5, 1, 0, 0.3]).rectangles;
  assert.equal(shapes.length, 7);
  assert.equal(shapes[4].height, 24);
  assert.equal(shapes[5].height, 3);
  assert.ok(shapes[1].height > shapes[0].height);
  assert.ok(shapes[0].height > shapes[2].height);
});

test("VIS-02: silence and invalid samples stay at rest", () => {
  assert.ok(paint([0, -1, NaN, Infinity, 0, 0, 0]).rectangles.every((shape) => shape.height === 3));
});

test("VIS-03: system audio remains reactive without a playing media session", () => {
  const html = renderToStaticMarkup(createElement(Waveform, { playing: false, visualizer: true }));
  assert.match(html, /is-peak/);
  assert.match(html, /<canvas/);
});

test("VIS-04: disabling the visualizer preserves the playback indicator", () => {
  const html = renderToStaticMarkup(createElement(Waveform, { playing: true, visualizer: false }));
  assert.match(html, /is-playing/);
  assert.doesNotMatch(html, /is-peak/);
});

test("VIS-05: real audio bars retain their full height inside the drawing area", () => {
  const painter = paint([1, 1, 1, 1, 1, 1, 1]);
  assert.ok(painter.rectangles.every((shape) => shape.height === 24 && shape.y >= 0 && shape.y + shape.height <= 28));
});

test("VIS-06: moving energy between bands changes the shape", () => {
  const bass = paint([0.8, 0.2, 0, 0, 0, 0, 0]).rectangles;
  const treble = paint([0, 0, 0, 0, 0, 0.2, 0.8]).rectangles;
  assert.ok(bass[0].height > treble[0].height);
  assert.ok(treble[6].height > bass[6].height);
});

test("VIS-07: RGB palette changes across the frequency bands", () => {
  const painter = paint([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.match(painter.gradients[0].stops[0][1], /hsl\(168 /);
  assert.match(painter.gradients[6].stops[0][1], /hsl\(326 /);
});
