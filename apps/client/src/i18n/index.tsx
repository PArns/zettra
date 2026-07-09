import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_LANG, isLang, translate, type Lang, type StringKey } from './strings';

export { LANGUAGES, type Lang, type StringKey } from './strings';

const KEY = 'zettra.lang';

/** Persisted UI language (localStorage), falling back to the browser language then English. */
export function getLang(): Lang {
  const saved = localStorage.getItem(KEY);
  if (isLang(saved)) return saved;
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : '';
  return isLang(nav) ? nav : DEFAULT_LANG;
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getLang());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(KEY, next);
    setLangState(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t: (key) => translate(lang, key) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Fallback context for components rendered outside a provider (e.g. isolated unit tests). The
 * real app always mounts inside {@link I18nProvider} (see `main.tsx`), so this degrades to the
 * source language rather than crashing the render.
 */
const FALLBACK: I18nContextValue = {
  lang: DEFAULT_LANG,
  setLang: () => undefined,
  t: (key) => translate(DEFAULT_LANG, key),
};

/** Access the translator + current language, degrading to English outside a provider. */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext) ?? FALLBACK;
}

/** Shorthand for components that only need the translate function. */
export function useT(): (key: StringKey) => string {
  return useI18n().t;
}
