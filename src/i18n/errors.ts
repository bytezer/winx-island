import type { TFunction, TranslateParams } from "./translate";

/**
 * A user-facing error, kept as a key plus parameters instead of text so it can
 * be re-rendered when the language changes.
 *
 * Native commands return keys such as `error.local_player_unavailable`. Anything
 * that is not a catalog key (an OS message, a dynamic `format!`) passes through
 * unchanged because `translate` falls back to the key itself.
 */
export interface UiError {
  key: string;
  params?: TranslateParams;
}

/** Wraps a rejected `invoke` reason, which may be a string or an Error. */
export function toUiError(reason: unknown): UiError {
  if (typeof reason === "object" && reason !== null && "key" in reason) {
    return reason as UiError;
  }
  return { key: String(reason) };
}

export function errorText(t: TFunction, error: UiError | null | undefined): string | null {
  if (!error) return null;
  return t(error.key, error.params);
}
