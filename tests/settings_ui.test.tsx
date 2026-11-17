import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppearanceStudio } from "../src/settings/AppearanceEditor";
import { FrameControls } from "../src/settings/FrameControls";
import { LocaleProvider } from "../src/i18n/LocaleContext";
import { translate } from "../src/i18n/translate";
import { DEFAULT_THEME } from "../src/lib/theme";
import type { Appearance } from "../src/types";

/**
 * Labels come from the catalog instead of being hardcoded here, so editing a
 * translation never breaks these assertions. The locale is pinned to English.
 */
const en = (key: string) => translate("en", key);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const appearance: Appearance = {
  compactWidth: 132,
  compactHeight: 40,
  offsetX: 0,
  offsetY: 0,
  theme: "midnight",
};

function render(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(
    createElement(LocaleProvider, { language: "en" }, node),
  );
}

test("SETTINGS-01: the embedded editor keeps the brand band but not the hero", () => {
  const html = render(createElement(AppearanceStudio, { initial: DEFAULT_THEME, appearance }));
  // Compact band with the eyebrow and the draft status.
  assert.match(html, new RegExp(escape(en("appearance_editor.eyebrow"))));
  assert.match(html, /class="[^"]*appearance-band/);
  assert.match(html, /class="[^"]*draft-status/);
  // The hero h1 and its subtitle are gone.
  assert.doesNotMatch(html, new RegExp(escape(en("appearance_editor.title"))));
  assert.doesNotMatch(html, /<h1/);
  // The old window-scoped header element is gone.
  assert.doesNotMatch(html, /class="[^"]*appearance-header/);
});

test("SETTINGS-02: the editor exposes the three control blocks", () => {
  const html = render(createElement(AppearanceStudio, { initial: DEFAULT_THEME, appearance }));
  for (const key of [
    "appearance_editor.section_island",
    "appearance_editor.section_bars",
    "settings.frame.title",
  ]) {
    assert.ok(html.includes(en(key)), `${key} (${en(key)}) missing from the editor markup`);
  }
  // The immediate-apply hint travels with the frame block.
  assert.ok(html.includes(en("settings.frame.hint")));
});

test("SETTINGS-03: the footer saves and discards, it never closes", () => {
  const html = render(createElement(AppearanceStudio, { initial: DEFAULT_THEME, appearance }));
  assert.ok(html.includes(en("appearance_editor.save")));
  assert.ok(html.includes(en("appearance_editor.cancel")));
  // The window close variant is gone: the header X closes the window.
  assert.doesNotMatch(html, new RegExp(`>${escape(en("appearance_editor.dismiss"))}<`));
});

test("SETTINGS-04: frame controls offer every CSS theme", () => {
  const html = render(createElement(FrameControls, { appearance }));
  for (const theme of ["midnight", "graphite", "ocean", "glass"]) {
    assert.ok(
      html.includes(en(`settings.theme_names.${theme}`)),
      `theme ${theme} label missing from the frame controls`,
    );
    assert.match(html, new RegExp(`settings-swatch-${theme}`));
  }
});

test("SETTINGS-05: frame controls expose size and position", () => {
  const html = render(createElement(FrameControls, { appearance }));
  assert.ok(html.includes(en("settings.appearance.pill_size")));
  assert.ok(html.includes(en("settings.appearance.width")));
  assert.ok(html.includes(en("settings.appearance.height")));
  assert.ok(html.includes(en("settings.appearance.reset_position")));
  assert.match(html, /type="range"/);
});
