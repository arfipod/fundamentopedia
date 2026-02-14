import type { LocaleMap, ProfileRoot } from '../types';

let localeEsCache: LocaleMap | null = null;

export async function loadProfile(): Promise<ProfileRoot> {
  const response = await fetch('/data/gics_watchlist_scorecard_profile_en.json');
  if (!response.ok) {
    throw new Error(`Failed to load profile: ${response.status}`);
  }
  return (await response.json()) as ProfileRoot;
}

export async function loadLocaleEs(): Promise<LocaleMap> {
  if (localeEsCache) {
    return localeEsCache;
  }

  const response = await fetch('/data/locale_es.json');
  if (!response.ok) {
    throw new Error(`Failed to load Spanish locale: ${response.status}`);
  }

  localeEsCache = (await response.json()) as LocaleMap;
  return localeEsCache;
}
