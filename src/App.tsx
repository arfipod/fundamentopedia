import { useEffect, useMemo, useState } from 'react';
import { loadProfile } from './data/loader';
import type { GicsLevel, ProfileRoot } from './types';
import { buildIndexes, type IndexedData } from './data/indexer';
import { Navbar } from './ui/Navbar';
import { SearchBox } from './ui/SearchBox';
import { TreeNav } from './ui/TreeNav';
import { NodeDetail } from './ui/NodeDetail';
import { FinancialAnalysis } from './ui/FinancialAnalysis';
import { resolveGeneralProfile, resolveGicsProfile } from './data/profileResolver';
import { useI18n } from './i18n/i18n';
import { migrateAndResolveGicsCode } from './data/gicsCodeMigration';

export type AppView = 'encyclopedia' | 'financials';

const SELECTED_GICS_STORAGE_KEY = 'fundamentopedia.selectedGicsCode';

function loadPersistedCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  for (const key of ['gics', 'code', 'gicsCode']) {
    const value = params.get(key);
    if (value) return value;
  }

  return window.localStorage.getItem(SELECTED_GICS_STORAGE_KEY);
}

function persistSelectedCode(code: string | null) {
  const url = new URL(window.location.href);
  if (code) {
    window.localStorage.setItem(SELECTED_GICS_STORAGE_KEY, code);
    url.searchParams.set('gics', code);
  } else {
    window.localStorage.removeItem(SELECTED_GICS_STORAGE_KEY);
    url.searchParams.delete('gics');
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function App() {
  const { lang } = useI18n();
  const [profile, setProfile] = useState<ProfileRoot | null>(null);
  const [indexes, setIndexes] = useState<IndexedData | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<GicsLevel>('industry');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'financials' ? 'financials' : 'encyclopedia';
  });

  useEffect(() => {
    const run = async () => {
      try {
        const loaded = await loadProfile();
        const built = buildIndexes(loaded);
        setProfile(loaded);
        setIndexes(built);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const selectedNode = useMemo(
    () => (selectedCode && profile ? resolveGicsProfile(profile, selectedCode) : null),
    [profile, selectedCode],
  );
  const generalNode = useMemo(() => (profile ? resolveGeneralProfile(profile) : null), [profile]);
  const knownCodes = useMemo(() => (profile ? new Set(Object.keys(profile.gics_profile_index)) : null), [profile]);

  useEffect(() => {
    if (!knownCodes) return;
    const persistedCode = loadPersistedCode();
    if (!persistedCode) {
      setSelectionHydrated(true);
      return;
    }

    const resolved = migrateAndResolveGicsCode(persistedCode, knownCodes);
    if (resolved) {
      setSelectedCode(resolved);
      persistSelectedCode(resolved);
    }
    setSelectionHydrated(true);
  }, [knownCodes]);

  useEffect(() => {
    if (!profile || !selectedNode || selectedNode.level === granularity) return;
    const firstMatchCode = Object.keys(profile.gics_profile_index).find((code) => profile.gics_profile_index[code].level === granularity);
    setSelectedCode(firstMatchCode ?? null);
  }, [granularity, profile, selectedNode]);

  useEffect(() => {
    if (!profile || !selectionHydrated) return;
    persistSelectedCode(selectedCode);
  }, [profile, selectedCode, selectionHydrated]);

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)');
    const updateOrientation = () => {
      const portrait = media.matches;
      setIsPortrait(portrait);
      setIsTreeCollapsed(portrait);
    };

    updateOrientation();
    media.addEventListener('change', updateOrientation);
    return () => media.removeEventListener('change', updateOrientation);
  }, []);

  if (loading) {
    return <div className="d-flex justify-content-center p-5"><div className="spinner-border" /></div>;
  }

  if (error || !profile || !indexes) {
    return <div className="alert alert-danger m-3">{error ?? 'Failed to load data.'}</div>;
  }

  return (
    <div>
      <Navbar
        granularity={granularity}
        onGranularityChange={setGranularity}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        activeView={activeView}
        onViewChange={(v) => {
          setActiveView(v);
          const url = new URL(window.location.href);
          if (v === 'financials') url.searchParams.set('view', 'financials');
          else url.searchParams.delete('view');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }}
      />
      <div className="container-fluid py-3">
        {activeView === 'financials' ? (
          <FinancialAnalysis profile={profile} gicsItems={indexes.searchItems} />
        ) : (
          <div className="row">
            <div className="col-lg-3 position-relative">
              <SearchBox
                query={searchText}
                items={indexes.searchItems}
                onSelect={(code) => {
                  setSelectedCode(code);
                  setSearchText('');
                  setIsTreeCollapsed(false);
                }}
              />
              <div className="mb-2 d-grid">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedCode(null)}>
                  {lang === 'es' ? 'Ver métricas generales (sin GICS)' : 'View general metrics (no GICS)'}
                </button>
              </div>
              {isPortrait ? (
                <div className="mb-2 d-grid">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setIsTreeCollapsed((prev) => !prev)}
                    aria-expanded={!isTreeCollapsed}
                  >
                    {isTreeCollapsed
                      ? (lang === 'es' ? 'Mostrar árbol de industrias' : 'Show industry tree')
                      : (lang === 'es' ? 'Ocultar árbol de industrias' : 'Hide industry tree')}
                  </button>
                </div>
              ) : null}
              {!isTreeCollapsed ? (
                <div className="border rounded p-2" style={{ maxHeight: '80vh', overflow: 'auto' }}>
                  <TreeNav tree={profile.gics_tree} selectedCode={selectedCode} granularity={granularity} onSelect={setSelectedCode} />
                </div>
              ) : null}
            </div>
            <div className="col-lg-9">
              {selectedCode && selectedNode ? (
                <NodeDetail
                  code={selectedCode}
                  node={selectedNode}
                  profile={profile}
                  breadcrumbCodes={selectedNode.path}
                />
              ) : generalNode ? (
                <NodeDetail
                  code="general"
                  node={generalNode}
                  profile={profile}
                  breadcrumbCodes={[]}
                />
              ) : (
                <div className="alert alert-info">Select a node from the tree.</div>
              )}
            </div>
          </div>
        )}
      </div>
      <footer className="text-center text-muted small pb-3">Made with 💙 by arrf</footer>
    </div>
  );
}
