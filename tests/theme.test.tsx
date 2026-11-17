import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, normalizeTheme, barPaint, themeVariables } from "../src/lib/theme";
import { layoutFor } from "../src/lib/layout";

const appearance = { compactWidth: 132, compactHeight: 40, offsetX: 0, offsetY: 0 };

test("THEME-01: older settings keep the existing rounded RGB appearance", () => {
  assert.deepEqual(normalizeTheme({}), DEFAULT_THEME);
  assert.equal(layoutFor(appearance).compact.radius, 20);
  assert.notEqual(barPaint(DEFAULT_THEME, 0).base, barPaint(DEFAULT_THEME, 6).base);
});

test("THEME-02: square corners apply to every island state", () => {
  const shapes = layoutFor(appearance, 0);
  assert.ok(Object.values(shapes).every((shape) => shape.radius === 0));
  assert.equal(layoutFor(appearance, 25).compact.radius, 5);
});

test("THEME-03: solid mode uses the chosen color across all bars", () => {
  const theme = { ...DEFAULT_THEME, colorMode: "solid" as const, solidColor: "#ff6600" };
  for (let index = 0; index < 7; index++) {
    assert.deepEqual(barPaint(theme, index), { base: "#ff6600", tip: "#ff6600" });
  }
});

test("THEME-04: custom gradients preserve their endpoints and middle", () => {
  const theme = { ...DEFAULT_THEME, colorMode: "gradient" as const, gradientStart: "#ff0000", gradientMiddle: "#00ff00", gradientEnd: "#0000ff" };
  assert.equal(barPaint(theme, 0).base, "#ff0000");
  assert.equal(barPaint(theme, 3).base, "#00ff00");
  assert.equal(barPaint(theme, 6).base, "#0000ff");
});

test("THEME-05: invalid colors and bounds are normalized safely", () => {
  const theme = normalizeTheme({ islandRoundness: -50, barRoundness: 200, solidColor: "red; display:none", gradientStart: "#ABCDEF" });
  assert.equal(theme.islandRoundness, 0);
  assert.equal(theme.barRoundness, 100);
  assert.equal(theme.solidColor, DEFAULT_THEME.solidColor);
  assert.equal(theme.gradientStart, "#abcdef");
});

test("THEME-06: changing a draft does not mutate the defaults", () => {
  const draft = normalizeTheme({ ...DEFAULT_THEME, islandRoundness: 0, barRoundness: 0 });
  assert.equal(draft.barRoundness, 0);
  assert.equal(DEFAULT_THEME.barRoundness, 100);
});

test("THEME-07: preview and island bars share the same color and corner renderer", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { AppearancePreview } = await import("../src/settings/AppearancePreview");
  const { SpectrumBars } = await import("../src/island/Waveform");
  const theme = { ...DEFAULT_THEME, islandRoundness: 0, barRoundness: 0, colorMode: "solid" as const, solidColor: "#ff6600", glow: false };
  const bands = [0.2, 0.6, 0.3, 0.8, 0.4, 0.9, 0.1];
  const preview = renderToStaticMarkup(createElement(AppearancePreview, { appearance, theme, bands, view: "compact" }));
  const bars = renderToStaticMarkup(createElement(SpectrumBars, { theme, bands, playing: true, visualizer: true }));
  assert.match(preview, /border-radius:0/);
  assert.ok(preview.includes(bars));
});

test("THEME-08: preview supports compact, hover and panel shapes", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { AppearancePreview } = await import("../src/settings/AppearancePreview");
  for (const view of ["compact", "hover", "panel"] as const) {
    const html = renderToStaticMarkup(createElement(AppearancePreview, { appearance, theme: { ...DEFAULT_THEME, islandRoundness: 0 }, bands: [], view }));
    assert.match(html, /border-radius:0/);
    assert.ok(html.includes(`data-view="${view}"`));
  }
});


test("THEME-09: text stays readable on independently chosen light and dark backgrounds", () => {
  const theme = { ...DEFAULT_THEME, backgroundColor: "#ffffff", raisedColor: "#101010" };
  assert.equal(themeVariables(theme, "compact")["--text" as keyof ReturnType<typeof themeVariables>], "#172139");
  assert.equal(themeVariables(theme, "hover")["--text" as keyof ReturnType<typeof themeVariables>], "#f5f5f7");
});
