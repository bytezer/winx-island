import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, normalizeLocale, translate, type Locale, type TFunction } from "./translate";

interface LocaleValue {
  locale: Locale;
  t: TFunction;
}

/**
 * Rendered outside a provider (a component mounted in isolation during a test,
 * for instance) still resolves keys, just in the default locale.
 */
const FALLBACK: LocaleValue = {
  locale: DEFAULT_LOCALE,
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
};

const LocaleContext = createContext<LocaleValue>(FALLBACK);

interface LocaleProviderProps {
  /** Resolved language from the native side; invalid values fall back to English. */
  language: string | null | undefined;
  children: ReactNode;
}

export function LocaleProvider({ language, children }: LocaleProviderProps) {
  const value = useMemo<LocaleValue>(() => {
    const locale = normalizeLocale(language);
    return { locale, t: (key, params) => translate(locale, key, params) };
  }, [language]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Translation function for the active locale. */
export function useT(): TFunction {
  return useContext(LocaleContext).t;
}

/** Active locale, for the rare case a component needs the raw tag. */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}
