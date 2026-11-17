import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { hasKey, normalizeLocale, translate } from "../src/i18n/translate";

/**
 * Runs from the repository root, like the other suites in this directory.
 */
const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const catalog = (locale: string) => JSON.parse(read(`locales/${locale}.json`));

/** Flattens a catalog into dotted key paths, treating plural nodes as leaves. */
function flatten(node: unknown, prefix = "", out: string[] = []): string[] {
  if (typeof node !== "object" || node === null) return out;
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !("one" in value && "other" in value)) {
      flatten(value, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

function leafValues(node: unknown, prefix = "", out: [string, unknown][] = []): [string, unknown][] {
  if (typeof node !== "object" || node === null) return out;
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !("one" in value && "other" in value)) {
      leafValues(value, path, out);
    } else {
      out.push([path, value]);
    }
  }
  return out;
}

/** Every `error.*` key literal written in the Rust sources. */
function rustErrorKeys(): string[] {
  const dir = join(root, "src-tauri/src");
  const keys = new Set<string>();
  const walk = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".rs")) {
        for (const match of readFileSync(full, "utf8").matchAll(/"(error\.[a-z_]+)"/g)) {
          keys.add(match[1]);
        }
      }
    }
  };
  walk(dir);
  return [...keys].sort();
}

test("CATALOG-01: both locales expose the exact same key set", () => {
  const english = flatten(catalog("en")).sort();
  const spanish = flatten(catalog("es")).sort();
  assert.deepEqual(spanish, english);
  assert.ok(english.length > 150, `unexpectedly small catalog: ${english.length} keys`);
});

test("CATALOG-02: no catalog entry is empty", () => {
  for (const locale of ["en", "es"]) {
    for (const [key, value] of leafValues(catalog(locale))) {
      if (typeof value === "string") {
        assert.ok(value.trim().length > 0, `${locale}: empty value for ${key}`);
      } else {
        const plural = value as { one?: string; other?: string };
        assert.ok(plural.one?.trim(), `${locale}: empty plural.one for ${key}`);
        assert.ok(plural.other?.trim(), `${locale}: empty plural.other for ${key}`);
      }
    }
  }
});

test("CATALOG-03: every error key returned by Rust exists in both locales", () => {
  const keys = rustErrorKeys();
  assert.ok(keys.length > 10, `expected the Rust error keys to be found, got ${keys.length}`);
  for (const locale of ["en", "es"]) {
    const data = catalog(locale);
    for (const key of keys) {
      assert.ok(hasKey(locale as "en" | "es", key), `${locale} is missing ${key}`);
    }
    assert.ok(data.error, "catalog has no error section");
  }
});

test("CATALOG-04: the locale list in i18n.rs matches the shipped catalogs", () => {
  const source = read("src-tauri/src/i18n.rs");
  const declaration = source.match(/pub const LOCALES: \[&str; \d+\] = \[([^\]]+)\]/);
  assert.ok(declaration, "LOCALES declaration not found in i18n.rs");
  const declared = [...declaration[1].matchAll(/"([a-z]{2})"/g)].map((match) => match[1]).sort();
  const files = readdirSync(join(root, "locales"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .sort();
  assert.deepEqual(declared, files);
});

test("TRANSLATE-01: an unknown key falls back to the key itself", () => {
  assert.equal(translate("en", "nope.missing"), "nope.missing");
  assert.equal(translate("es", "error.does_not_exist"), "error.does_not_exist");
});

test("TRANSLATE-02: known keys resolve in both locales", () => {
  assert.equal(translate("en", "island.media.playing"), "Playing");
  assert.equal(translate("es", "island.media.playing"), "Reproduciendo");
  assert.notEqual(translate("en", "settings.title"), translate("es", "settings.title"));
});

test("TRANSLATE-03: parameters are interpolated", () => {
  assert.equal(translate("en", "island.library.queue", { index: 2, total: 3 }), "2 / 3");
  assert.equal(
    translate("es", "island.transport.repeat", { mode: translate("es", "island.transport.repeat_one") }),
    "Repetición: una canción",
  );
});

test("TRANSLATE-04: a missing parameter leaves its placeholder visible", () => {
  assert.equal(translate("en", "island.library.queue", { index: 2 }), "2 / {total}");
});

test("TRANSLATE-05: plurals pick the right form for the count", () => {
  assert.equal(translate("en", "error.folders_skipped", { count: 1 }), "1 folder could not be read.");
  assert.equal(translate("en", "error.folders_skipped", { count: 4 }), "4 folders could not be read.");
  assert.equal(translate("es", "error.folders_skipped", { count: 1 }), "1 carpeta no se pudo leer.");
  assert.equal(translate("es", "error.folders_skipped", { count: 4 }), "4 carpetas no se pudieron leer.");
  // A missing count is treated as "other" and leaves the placeholder visible.
  assert.equal(translate("en", "error.folders_skipped"), "{count} folders could not be read.");
});

test("TRANSLATE-06: every key resolves in both locales without throwing", () => {
  for (const locale of ["en", "es"] as const) {
    for (const key of flatten(catalog(locale))) {
      const value = translate(locale, key, { count: 2, index: 1, total: 2, error: "x", mode: "m", name: "n", label: "l" });
      assert.equal(typeof value, "string");
      assert.ok(value.length > 0, `${locale}: ${key} rendered empty`);
    }
  }
});

test("TRANSLATE-07: unknown language names fall back to English", () => {
  assert.equal(normalizeLocale("es"), "es");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), "en");
  assert.equal(normalizeLocale(""), "en");
  assert.equal(normalizeLocale(null), "en");
  assert.equal(normalizeLocale(undefined), "en");
});
