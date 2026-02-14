import type { LocaleMap } from '../types';

export type Lang = 'en' | 'es';

export function translate(lang: Lang, locale: LocaleMap, key: string, fallback: string): string {
  if (lang !== 'es') {
    return fallback;
  }
  return locale[key] ?? fallback;
}
