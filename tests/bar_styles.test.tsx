import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_THEME, CLASSIC_SPECTRUM, normalizeTheme } from "../src/lib/theme";
import { SpectrumContext } from "./helpers/spectrum-context";
import { LocaleProvider } from "../src/i18n/LocaleContext";
import { translate } from "../src/i18n/translate";
import { drawSpectrum, advanceSpectrumFrame } from "../src/lib/spectrum-renderer";
import { SpectrumBars } from "../src/island/Waveform";

const bands = [0.3, 0.8, 0.5, 0.9, 0.7, 0.2, 0.4];

test("BARS-01: continuous, segmented and dotted geometry remain distinct", () => {
  const frame = { bars: bands, peaks: [] };
  const smooth = new SpectrumContext();
  drawSpectrum(smooth.context(), 40, 28, frame, DEFAULT_THEME, false);
  assert.equal(smooth.rectangles.length, 7);
  assert.ok(smooth.rectangles.every((rect) => rect.radius === 2));
  const segmented = new SpectrumContext();
  drawSpectrum(segmented.context(), 40, 28, frame, { ...DEFAULT_THEME, barStyle: "segmented", barRoundness: 0 }, false);
  assert.ok(segmented.rectangles.length > 7);
  assert.ok(segmented.rectangles.every((rect) => rect.height === 2 && rect.radius === 0));
  const dots = new SpectrumContext();
  drawSpectrum(dots.context(), 40, 28, frame, { ...DEFAULT_THEME, barStyle: "dots" }, false);
  assert.ok(dots.circles.length > 7);
  assert.equal(dots.rectangles.length, 0);
});

test("BARS-02: the classic preset uses a fixed vertical energy gradient", () => {
  const classic = normalizeTheme({ ...DEFAULT_THEME, ...CLASSIC_SPECTRUM });
  assert.equal(classic.barStyle, "segmented");
  assert.equal(classic.barRoundness, 0);
  assert.equal(classic.peakEnabled, true);
  const painter = new SpectrumContext();
  drawSpectrum(painter.context(), 40, 28, { bars: bands, peaks: [] }, classic, true);
  assert.deepEqual(painter.gradients[0].coordinates, painter.gradients[6].coordinates);
  assert.deepEqual(painter.gradients[0].stops, [[0, classic.gradientStart], [0.5, classic.gradientMiddle], [1, classic.gradientEnd]]);
});

test("BARS-03: peak markers touch the seven bars when pushed", () => {
  const theme = { ...DEFAULT_THEME, peakEnabled: true };
  const frame = advanceSpectrumFrame({ bars: [], peaks: [] }, bands, 1, theme, true);
  const painter = new SpectrumContext();
  drawSpectrum(painter.context(), 40, 28, frame, theme, true);
  const barsDrawn = painter.rectangles.filter((rect) => rect.kind === "bar");
  const peaks = painter.rectangles.filter((rect) => rect.kind === "peak");
  assert.equal(barsDrawn.length, 7);
  assert.equal(peaks.length, 7);
  assert.ok(peaks.every((rect, index) => Math.abs(rect.y + rect.height - barsDrawn[index].y) < 1e-9));
});

test("BARS-04: older themes keep continuous bars without peak markers", () => {
  const old = normalizeTheme({ islandRoundness: 25 });
  assert.equal(old.barStyle, "smooth");
  assert.equal(old.peakEnabled, false);
  assert.equal(old.islandRoundness, 25);
  const html = renderToStaticMarkup(createElement(SpectrumBars, { bands, playing: true, visualizer: true, theme: old }));
  assert.doesNotMatch(html, /class="spectrum-peak"/);
});

test("BARS-05: peak options clamp unsafe values and reject unknown bar styles", () => {
  const theme = normalizeTheme({ ...JSON.parse('{"barStyle":"unknown","gradientDirection":"diagonal"}'), peakHoldMs: -100, peakGravity: 999 });
  assert.equal(theme.barStyle, "smooth");
  assert.equal(theme.gradientDirection, "horizontal");
  assert.equal(theme.peakHoldMs, 0);
  assert.equal(theme.peakGravity, 400);
});

test("BARS-06: disabling visualization also disables the peak animation", () => {
  const html = renderToStaticMarkup(createElement(SpectrumBars, { bands, playing: true, visualizer: false, theme: { ...DEFAULT_THEME, peakEnabled: true } }));
  assert.doesNotMatch(html, /class="spectrum-peak"/);
  assert.match(html, /is-playing/);
});

test("BARS-07: the editor exposes style, gradient direction and peak controls", async () => {
  const { AppearanceStudio } = await import("../src/settings/AppearanceEditor");
  const initial = normalizeTheme({ ...DEFAULT_THEME, ...CLASSIC_SPECTRUM });
  const html = renderToStaticMarkup(
    createElement(
      LocaleProvider,
      { language: "en" },
      createElement(AppearanceStudio, {
        initial,
        appearance: { compactWidth: 132, compactHeight: 40, offsetX: 0, offsetY: 0 },
        onClose: async () => {},
      }),
    ),
  );
  // Labels come from the catalog: editing a translation must not break this.
  const en = (key: string) => translate("en", key);
  for (const key of [
    "appearance_editor.bar_smooth",
    "appearance_editor.bar_segmented",
    "appearance_editor.bar_dots",
    "appearance_editor.classic_preset",
    "appearance_editor.peak_hold",
    "appearance_editor.peak_gravity",
    "appearance_editor.gradient_vertical",
  ]) {
    assert.ok(html.includes(en(key)), `${key} (${en(key)}) missing from the editor markup`);
  }
  assert.match(html, /data-style="segmented"/);
  assert.match(html, /<canvas/);
});
