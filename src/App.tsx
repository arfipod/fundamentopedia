import { useEffect, useMemo, useState } from 'react';
import { loadProfile } from './data/loader';
import type { GicsLevel, ProfileRoot } from './types';
import { buildIndexes, type IndexedData } from './data/indexer';
import { Navbar } from './ui/Navbar';
import { SearchBox } from './ui/SearchBox';
import { TreeNav } from './ui/TreeNav';
import { NodeDetail } from './ui/NodeDetail';

export default function App() {
  const [profile, setProfile] = useState<ProfileRoot | null>(null);
  const [indexes, setIndexes] = useState<IndexedData | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<GicsLevel>('industry');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const loaded = await loadProfile();
        const built = buildIndexes(loaded);
        setProfile(loaded);
        setIndexes(built);
        const firstMatchCode = Object.keys(loaded.gics_profile_index).find((code) => loaded.gics_profile_index[code].level === granularity);
        setSelectedCode(firstMatchCode ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const selectedNode = useMemo(
    () => (selectedCode && profile ? profile.gics_profile_index[selectedCode] ?? null : null),
    [profile, selectedCode],
  );

  useEffect(() => {
    if (!profile || !selectedNode || selectedNode.level === granularity) return;
    const firstMatchCode = Object.keys(profile.gics_profile_index).find((code) => profile.gics_profile_index[code].level === granularity);
    setSelectedCode(firstMatchCode ?? null);
  }, [granularity, profile, selectedNode]);

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
      />
      <div className="container-fluid py-3">
        <div className="row">
          <div className="col-lg-3 position-relative">
            <SearchBox
              query={searchText}
              items={indexes.searchItems}
              onSelect={(code) => {
                setSelectedCode(code);
                setSearchText('');
              }}
            />
            <div className="border rounded p-2" style={{ maxHeight: '80vh', overflow: 'auto' }}>
              <TreeNav tree={profile.gics_tree} selectedCode={selectedCode} granularity={granularity} onSelect={setSelectedCode} />
            </div>
          </div>
          <div className="col-lg-9">
            {selectedCode && selectedNode ? (
              <NodeDetail
                code={selectedCode}
                node={selectedNode}
                profile={profile}
                breadcrumbCodes={indexes.pathCodesByCode.get(selectedCode) ?? [selectedCode]}
              />
            ) : (
              <div className="alert alert-info">Select a node from the tree.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
