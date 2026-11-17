import en from "../../locales/en.json";
import es from "../../locales/es.json";

export type Locale = "en" | "es";

export const LOCALES: readonly Locale[] = ["en", "es"];
export const DEFAULT_LOCALE: Locale = "en";

/** A leaf that carries one form per plural category. Both languages use the same pair. */
interface PluralLeaf {
  one: string;
  other: string;
}

type Leaf = string | PluralLeaf;

interface CatalogNode {
  [key: string]: CatalogNode | Leaf;
}

export type TranslateParams = Record<string, string | number | undefined>;
export type TFunction = (key: string, params?: TranslateParams) => string;

const CATALOGS: Record<Locale, CatalogNode> = { en, es };

/** Unknown or missing names (hand-edited YAML) fall back to the default locale. */
export function normalizeLocale(value: string | null | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

function isPlural(value: unknown): value is PluralLeaf {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.one === "string" &&
    typeof candidate.other === "string" &&
    Object.keys(candidate).every((key) => key === "one" || key === "other")
  );
}

/** Walks a dotted key, stopping at the first segment that does not exist. */
function resolve(catalog: CatalogNode, key: string): Leaf | undefined {
  let node: CatalogNode | Leaf | undefined = catalog;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null || isPlural(node)) return undefined;
    node = (node as CatalogNode)[segment];
    if (node === undefined) return undefined;
  }
  if (typeof node === "string" || isPlural(node)) return node;
  return undefined;
}

function interpolate(template: string, params: TranslateParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Resolves a key for one locale.
 *
 * A missing key returns the key itself: that keeps unknown native error text
 * visible instead of swallowing it, and makes a forgotten catalog entry obvious.
 */
export function translate(locale: Locale, key: string, params: TranslateParams = {}): string {
  const leaf = resolve(CATALOGS[locale], key);
  if (leaf === undefined) return key;
  if (typeof leaf === "string") return interpolate(leaf, params);
  const count = typeof params.count === "number" ? params.count : Number.NaN;
  const template = count === 1 ? leaf.one : leaf.other;
  return interpolate(template, params);
}

/** True when the key exists in the given locale's catalog. */
export function hasKey(locale: Locale, key: string): boolean {
  return resolve(CATALOGS[locale], key) !== undefined;
}
