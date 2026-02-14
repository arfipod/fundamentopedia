import { createContext, useContext, useMemo, useState } from 'react';
import { loadLocaleEs } from '../data/loader';
import type { LocaleMap } from '../types';
import { translate, type Lang } from './translate';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => Promise<void>;
  t: (key: string, fallback: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [locale, setLocale] = useState<LocaleMap>({});

  const setLang = async (nextLang: Lang) => {
    if (nextLang === 'es' && Object.keys(locale).length === 0) {
      const esLocale = await loadLocaleEs();
      setLocale(esLocale);
    }
    setLangState(nextLang);
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string, fallback: string) => translate(lang, locale, key, fallback),
    }),
    [lang, locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
