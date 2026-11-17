import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType } from "react";
import { MusicLibraryControls } from "../src/island/MusicLibraryControls";
import { Transport } from "../src/island/Transport";
import { HoverCard } from "../src/island/HoverCard";
import { LocaleProvider } from "../src/i18n/LocaleContext";
import { translate, type TranslateParams } from "../src/i18n/translate";
import type { MediaSnapshot, MusicLibraryActions } from "../src/types";

/**
 * Labels are read from the catalog instead of being hardcoded here, so editing a
 * translation never breaks these assertions. The locale is pinned to English:
 * the promise under test is the markup contract, not the wording of one locale.
 */
const en = (key: string, params?: TranslateParams) => translate("en", key, params);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const label = (key: string, params?: TranslateParams) => `aria-label="${escape(en(key, params))}"`;

function render<P>(component: ComponentType<P>, props: P): string {
  return renderToStaticMarkup(
    createElement(LocaleProvider, { language: "en" }, createElement(component, props)),
  );
}

const empty: MediaSnapshot = {
  available: false, title: "", artist: "", album: "", playing: false,
  positionMs: 0, durationMs: 0, canNext: false, canPrev: false,
  canSeek: false, art: null, sourceApp: "", queueIndex: 0, queueLength: 0,
  playbackError: null, shuffleEnabled: false, repeatMode: "off",
};
const library: MusicLibraryActions = {
  busy: false, error: null, onOpen: () => {}, onFolders: () => {}, onSystem: () => {},
};

test("LOCAL-14: Play is enabled without an external media session", () => {
  const html = render(Transport, { media: empty, onAction: () => {} });
  const play = html.match(new RegExp(`<button[^>]+${label("island.transport.open_files")}[^>]*>`))?.[0];
  assert.ok(play);
  assert.doesNotMatch(play, /disabled/);
});

test("LOCAL-15: local queue exposes file selection and a switch to Windows", () => {
  const media = { ...empty, available: true, sourceApp: "winx-island.local", queueIndex: 1, queueLength: 3 };
  const html = render(MusicLibraryControls, { media, library });
  assert.match(html, new RegExp(escape(en("island.library.add_folders"))));
  assert.match(html, new RegExp(escape(en("island.library.queue", { index: 2, total: 3 }))));
  assert.match(html, new RegExp(escape(en("island.library.windows_aria"))));
});

test("LOCAL-16: file selection is disabled while a picker is open", () => {
  const html = render(MusicLibraryControls, {
    media: empty, library: { ...library, busy: true },
  });
  assert.match(html, /disabled=""/);
  assert.match(html, new RegExp(escape(en("island.library.adding"))));
});

test("LOCAL-17: playback and selection errors are accessible", () => {
  const html = render(MusicLibraryControls, {
    media: empty, library: { ...library, error: { key: "Missing audio file" } },
  });
  assert.match(html, /role="alert"/);
  assert.match(html, /Missing audio file/);
});

test("LOCAL-17b: catalog error keys are rendered in the active language", () => {
  const html = render(MusicLibraryControls, {
    media: empty, library: { ...library, error: { key: "error.local_player_unavailable" } },
  });
  assert.match(html, new RegExp(escape(en("error.local_player_unavailable"))));
  // The raw key must never leak into the markup.
  assert.doesNotMatch(html, /error\.local_player_unavailable/);
});

test("LOCAL-18: idle hover view offers direct file playback", () => {
  const html = render(HoverCard, {
    media: empty, library, positionMs: 0, visualizer: true,
    onAction: () => {}, onSeek: () => {},
  });
  assert.match(html, new RegExp(escape(en("island.media.empty_hint"))));
  assert.match(html, new RegExp(escape(en("island.library.add_folders"))));
  assert.doesNotMatch(html, /Open any player|Start playback in any app/);
});

test("FOLDER-08: folder import and individual files are both available", () => {
  const html = render(MusicLibraryControls, { media: empty, library });
  assert.match(html, new RegExp(escape(en("island.library.add_folders"))));
  assert.match(html, new RegExp(escape(en("island.library.add_folders_title"))));
  assert.match(html, new RegExp(label("island.transport.open_files")));
});

test("MODE-04: local controls announce shuffle and repeat-one state", () => {
  const html = render(Transport, {
    media: { ...empty, available: true, sourceApp: "winx-island.local", shuffleEnabled: true, repeatMode: "one" },
    onAction: () => {},
  });
  const repeat = en("island.transport.repeat", { mode: en("island.transport.repeat_one") });
  assert.match(html, new RegExp(`${label("island.transport.shuffle")}[^>]*aria-pressed="true"`));
  assert.match(html, new RegExp(`aria-label="${escape(repeat)}"[^>]*aria-pressed="true"`));
});

test("MODE-05: system sessions do not expose local mode buttons", () => {
  const html = render(Transport, { media: { ...empty, available: true, sourceApp: "browser" }, onAction: () => {} });
  assert.doesNotMatch(html, new RegExp(label("island.transport.shuffle")));
  assert.doesNotMatch(html, /aria-label="Repeat/);
});

test("MEDIA-UI-01: source controls expose automatic, local and distinct browser sessions", () => {
  const media = { ...empty, sourceSelection: "auto", selectedSourceId: "system:2", sources: [
    { id: "system:1", label: "Edge", title: "YouTube", playing: false },
    { id: "system:2", label: "Spotify", title: "Track", playing: true },
    { id: "local", label: "Local files", title: "Song", playing: false },
  ] };
  const html = render(MusicLibraryControls, { media, library: { ...library, onSource: () => {} } });
  assert.match(html, new RegExp(escape(en("island.library.sources_group"))));
  assert.match(html, new RegExp(escape(en("island.library.source_auto"))));
  assert.match(html, /Edge · YouTube/);
  assert.match(html, /Spotify · Track/);
  assert.match(html, /Local files/);
  assert.match(html, /data-current="true"/);
});

test("MEDIA-UI-02: global playback offers media keys instead of opening folders", () => {
  const html = render(Transport, { media: { ...empty, sourceSelection: "auto", canPlayPause: true, canNext: true, canPrev: true }, onAction: () => {} });
  assert.match(html, new RegExp(label("island.transport.play")));
  assert.doesNotMatch(html, /Open music files|disabled/);
});

test("MEDIA-UI-03: unsupported playback controls are disabled without hiding audio visualization", () => {
  const html = render(Transport, { media: { ...empty, available: true, canPlayPause: false, sourceApp: "browser" }, onAction: () => {} });
  assert.match(html, new RegExp(`disabled=""[^>]*${label("island.transport.play")}`));
});
