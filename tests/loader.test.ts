import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLocaleEs, loadProfile } from '../src/data/loader';

describe('loader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads profile from root endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schema_version: '1' }) }));
    const data = await loadProfile();
    expect(data.schema_version).toBe('1');
    expect(fetch).toHaveBeenCalledWith('/data/gics_watchlist_scorecard_profile_en.json');
  });

  it('loads locale and caches results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hola: 'hola' }) });
    vi.stubGlobal('fetch', fetchMock);

    const first = await loadLocaleEs();
    const second = await loadLocaleEs();

    expect(first.hola).toBe('hola');
    expect(second.hola).toBe('hola');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadProfile()).rejects.toThrow('Failed to load profile: 500');
  });
});
