import type { LocaleMap, ProfileRoot } from '../types';

let localeEsCache: LocaleMap | null = null;

async function fetchJson<T>(urls: string[]): Promise<T> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch JSON');
}

export async function loadProfile(): Promise<ProfileRoot> {
  return fetchJson<ProfileRoot>(['/gics_watchlist_scorecard_profile_en.json', '/data/gics_watchlist_scorecard_profile_en.json']);
}

export async function loadLocaleEs(): Promise<LocaleMap> {
  if (localeEsCache) {
    return localeEsCache;
  }

  localeEsCache = await fetchJson<LocaleMap>(['/locale_es.json', '/data/locale_es.json']);

  return localeEsCache;
}
