import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MusicLibraryControls } from "../src/island/MusicLibraryControls";
import { Transport } from "../src/island/Transport";
import { HoverCard } from "../src/island/HoverCard";
import type { MediaSnapshot, MusicLibraryActions } from "../src/types";

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
  const html = renderToStaticMarkup(createElement(Transport, { media: empty, onAction: () => {} }));
  const play = html.match(/<button[^>]+aria-label="Open music files"[^>]*>/)?.[0];
  assert.ok(play);
  assert.doesNotMatch(play, /disabled/);
});

test("LOCAL-15: local queue exposes file selection and a switch to Windows", () => {
  const media = { ...empty, available: true, sourceApp: "winx-island.local", queueIndex: 1, queueLength: 3 };
  const html = renderToStaticMarkup(createElement(MusicLibraryControls, { media, library }));
  assert.match(html, /Add folders/);
  assert.match(html, /2 \/ 3/);
  assert.match(html, /Windows controls/);
});

test("LOCAL-16: file selection is disabled while a picker is open", () => {
  const html = renderToStaticMarkup(createElement(MusicLibraryControls, {
    media: empty, library: { ...library, busy: true },
  }));
  assert.match(html, /disabled=""/);
  assert.match(html, /Adding/);
});

test("LOCAL-17: playback and selection errors are accessible", () => {
  const html = renderToStaticMarkup(createElement(MusicLibraryControls, {
    media: empty, library: { ...library, error: "Missing audio file" },
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Missing audio file/);
});

test("LOCAL-18: idle hover view offers direct file playback", () => {
  const html = renderToStaticMarkup(createElement(HoverCard, {
    media: empty, library, positionMs: 0, visualizer: true,
    onAction: () => {}, onSeek: () => {},
  }));
  assert.match(html, /Choose music from your PC/);
  assert.match(html, /Add folders/);
  assert.doesNotMatch(html, /Open any player|Start playback in any app/);
});


test("FOLDER-08: folder import and individual files are both available", () => {
  const html = renderToStaticMarkup(createElement(MusicLibraryControls, { media: empty, library }));
  assert.match(html, /Add folders/);
  assert.match(html, /including music in subfolders/);
  assert.match(html, /aria-label="Open music files"/);
});

test("MODE-04: local controls announce shuffle and repeat-one state", () => {
  const html = renderToStaticMarkup(createElement(Transport, {
    media: { ...empty, available: true, sourceApp: "winx-island.local", shuffleEnabled: true, repeatMode: "one" },
    onAction: () => {},
  }));
  assert.match(html, /aria-label="Aleatorio"[^>]*aria-pressed="true"/);
  assert.match(html, /aria-label="Repetición: una canción"[^>]*aria-pressed="true"/);
});

test("MODE-05: system sessions do not expose local mode buttons", () => {
  const html = renderToStaticMarkup(createElement(Transport, { media: { ...empty, available: true, sourceApp: "browser" }, onAction: () => {} }));
  assert.doesNotMatch(html, /Aleatorio|Repetición:/);
});
