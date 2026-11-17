import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Runs from the repository root, like the other suites in this directory.
 */
const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** The shared token file under test. */
const STUDIO = "src/settings/studio.css";

/** The two stylesheets being re-tokenized onto the studio palette. */
const CONSUMERS = ["src/settings/settings.css", "src/settings/appearance.css"];

/**
 * Studio variables that paint the settings window's opaque surfaces. The glass
 * variant must keep them fully opaque: this window is not transparent, and a
 * translucent surface would let WebView2's white page show through. The
 * decorative `--studio-dots` / `--studio-stage-glow` tints are excluded on
 * purpose: they layer translucent hex over an opaque base, so they never
 * paint the window background.
 */
const SURFACE_VARS = [
  "--studio-bg",
  "--studio-card",
  "--studio-input",
  "--studio-well",
  "--studio-bar",
];

/** One `:root` / `:root[data-theme=...]` rule from studio.css. */
interface StudioBlock {
  /** Raw selector text, everything before the opening brace. */
  selector: string;
  /** `data-theme` values in the selector, e.g. `["graphite"]`. */
  themes: string[];
  /** True when the selector list includes the bare `:root`. */
  bare: boolean;
  /** Every `--studio-*` name defined here, in order, repeats included. */
  names: string[];
  /** Name to raw value; a repeated name overwrites, which STUDIO-01 flags. */
  defs: Map<string, string>;
}

/** Removes CSS block comments so prose cannot be parsed as rules or usage. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Finds every `:root` / `:root[data-theme=...]` block and the `--studio-*`
 * custom properties it declares. The midnight defaults open with a two-name
 * selector list, `:root, :root[data-theme="midnight"]`, so one block carries
 * both the bare flag and its theme alias.
 */
function parseRootBlocks(css: string): StudioBlock[] {
  const blocks: StudioBlock[] = [];
  for (const match of stripCssComments(css).matchAll(/:root[^{]*\{([^}]*)\}/g)) {
    const body = match[1];
    const selector = match[0].slice(0, match[0].length - body.length - 2);
    const names: string[] = [];
    const defs = new Map<string, string>();
    for (const declaration of body.split(";")) {
      const hit = declaration.match(/^\s*(--studio-[a-z0-9-]+)\s*:\s*([\s\S]*)$/);
      if (!hit) continue;
      names.push(hit[1]);
      defs.set(hit[1], hit[2].trim());
    }
    blocks.push({
      selector,
      names,
      defs,
      themes: [...selector.matchAll(/data-theme="([^"]*)"/g)].map((found) => found[1]),
      bare: selector.split(",").some((part) => part.trim() === ":root"),
    });
  }
  return blocks;
}

/** Every `--studio-*` name defined in any `:root` block of the text. */
function definedStudioNames(css: string): Set<string> {
  const names = new Set<string>();
  for (const block of parseRootBlocks(css)) {
    for (const name of block.defs.keys()) names.add(name);
  }
  return names;
}

/** Every `--studio-*` name consumed through `var(...)` in the text. */
function consumedStudioVars(css: string): string[] {
  return [...stripCssComments(css).matchAll(/var\(\s*(--studio-[a-z0-9-]+)/g)].map((hit) => hit[1]);
}

/** The undefined subset of `consumed`, deduped and sorted for a message. */
function undefinedVars(consumed: string[], defined: Set<string>): string[] {
  return [...new Set(consumed)].filter((name) => !defined.has(name)).sort();
}

/** Single-line selector text, for assertion messages. */
function label(block: StudioBlock): string {
  return block.selector.replace(/\s+/g, " ").trim();
}

test("STUDIO-01: four :root blocks define the identical --studio-* set", () => {
  const blocks = parseRootBlocks(read(STUDIO));
  assert.equal(blocks.length, 4, `expected four :root blocks, found ${blocks.length}`);
  for (const block of blocks) {
    assert.equal(new Set(block.names).size, block.names.length, `${label(block)} defines a name twice`);
  }
  const reference = [...blocks[0].defs.keys()].sort();
  for (const block of blocks) {
    assert.deepEqual([...block.defs.keys()].sort(), reference, `${label(block)} deviates from the shared set`);
  }
});

test("STUDIO-02: the palette keeps at least fifteen variables", () => {
  const blocks = parseRootBlocks(read(STUDIO));
  assert.ok(blocks.length > 0, "studio.css has no :root blocks");
  const count = blocks[0].defs.size;
  assert.ok(count >= 15, `expected at least 15 --studio-* variables, found ${count}`);
});

test("STUDIO-03: the consumers only reference variables studio.css defines", () => {
  const defined = definedStudioNames(read(STUDIO));
  for (const file of CONSUMERS) {
    const offenders = undefinedVars(consumedStudioVars(read(file)), defined);
    assert.deepEqual(offenders, [], `${file} consumes undefined studio variables: ${offenders.join(", ")}`);
  }
});

test("STUDIO-04: studio.css does not consume what it does not define", () => {
  const css = read(STUDIO);
  const offenders = undefinedVars(consumedStudioVars(css), definedStudioNames(css));
  assert.deepEqual(offenders, [], `studio.css consumes undefined studio variables: ${offenders.join(", ")}`);
});

test("STUDIO-05: the variants are exactly midnight, graphite, ocean and glass", () => {
  const blocks = parseRootBlocks(read(STUDIO));
  assert.equal(blocks.length, 4, `expected four :root blocks, found ${blocks.length}`);

  const bare = blocks.filter((block) => block.bare);
  assert.equal(bare.length, 1, "expected exactly one bare :root block");
  assert.deepEqual(bare[0].themes, ["midnight"], "the bare block must alias data-theme midnight");

  for (const block of blocks) {
    if (block.bare) continue;
    assert.equal(block.themes.length, 1, `expected one data-theme value on ${label(block)}`);
  }

  const themes = blocks.flatMap((block) => block.themes).sort();
  assert.deepEqual(themes, ["glass", "graphite", "midnight", "ocean"]);
});

test("STUDIO-06: the glass variant keeps its window surfaces opaque", () => {
  const blocks = parseRootBlocks(read(STUDIO));
  const glass = blocks.find((block) => block.themes.includes("glass"));
  assert.ok(glass, "no :root[data-theme=glass] block found");

  for (const name of SURFACE_VARS) {
    const value = glass.defs.get(name);
    assert.ok(value !== undefined, `the glass block is missing ${name}`);
    assert.ok(!/rgba\(/i.test(value), `${name} is translucent in glass: ${value}`);
    for (const hex of value.matchAll(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?/g)) {
      if (hex[0].length !== 9) continue;
      assert.equal(hex[0].slice(7).toLowerCase(), "ff", `${name} has a translucent hex in glass: ${value}`);
    }
  }
});
