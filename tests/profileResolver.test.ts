import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { GicsTreeNode, ProfileRoot, TreeWatchlist } from '../src/types';
import { resolveGicsProfile } from '../src/data/profileResolver';

function loadProfileFixture(): ProfileRoot {
  const filePath = path.resolve(process.cwd(), 'public/data/gics_watchlist_scorecard_profile_en.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ProfileRoot;
}

function walkTree(nodes: GicsTreeNode[], visitor: (node: GicsTreeNode) => void) {
  for (const node of nodes) {
    visitor(node);
    if (node.children?.length) {
      walkTree(node.children, visitor);
    }
  }
}

function toSet(values: string[]): Set<string> {
  return new Set(values);
}

function sameSet(left: string[], right: string[]): boolean {
  const a = toSet(left);
  const b = toSet(right);
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function flattenWatchlist(watchlist: TreeWatchlist): string[] {
  return [...watchlist.core, ...watchlist.risk, ...watchlist.secondary];
}

describe('resolveGicsProfile', () => {
  const profile = loadProfileFixture();

  it('falls back to parent code when exact code is missing', () => {
    const sector = resolveGicsProfile(profile, '10');
    const fallback = resolveGicsProfile(profile, '10101099');
    expect(sector).toBeTruthy();
    expect(fallback).toBeTruthy();
    expect(fallback?.code).toBe('101010');
  });

  it('validates graph references, dedupe, and recompute parity', () => {
    const metricLibraryIds = new Set(Object.keys(profile.metric_library));

    for (const template of Object.values(profile.templates)) {
      for (const metricId of flattenWatchlist(template)) {
        expect(metricLibraryIds.has(metricId), `Template references unknown metric: ${metricId}`).toBe(true);
      }
    }

    walkTree(profile.gics_tree, (node) => {
      for (const metricId of flattenWatchlist(node.watchlist ?? { core: [], risk: [], secondary: [] })) {
        expect(metricLibraryIds.has(metricId), `${node.code} watchlist references unknown metric: ${metricId}`).toBe(true);
      }
      for (const metricId of [
        ...(node.overrides?.add_core ?? []),
        ...(node.overrides?.add_risk ?? []),
        ...(node.overrides?.add_secondary ?? []),
        ...(node.overrides?.remove ?? []),
      ]) {
        expect(metricLibraryIds.has(metricId), `${node.code} override references unknown metric: ${metricId}`).toBe(true);
      }

      const resolved = resolveGicsProfile(profile, node.code, { recomputeFromGraph: true });
      expect(resolved, `No resolved profile for ${node.code}`).toBeTruthy();
      if (!resolved) return;

      const coreSet = toSet(resolved.watchlist.core);
      const riskSet = toSet(resolved.watchlist.risk);
      const secondarySet = toSet(resolved.watchlist.secondary);

      expect([...coreSet].every((metricId) => !riskSet.has(metricId) && !secondarySet.has(metricId)), `${node.code} duplicates in core`).toBe(true);
      expect([...riskSet].every((metricId) => !secondarySet.has(metricId)), `${node.code} duplicates in risk`).toBe(true);

      if (node.watchlist) {
        expect(sameSet(resolved.watchlist.core, node.watchlist.core), `${node.code} core mismatch`).toBe(true);
        expect(sameSet(resolved.watchlist.risk, node.watchlist.risk), `${node.code} risk mismatch`).toBe(true);
        expect(sameSet(resolved.watchlist.secondary, node.watchlist.secondary), `${node.code} secondary mismatch`).toBe(true);
      }

      const weightedMetricIds = Object.keys(resolved.metric_weights);
      expect(weightedMetricIds.every((metricId) => !resolved.informational_metrics.includes(metricId)), `${node.code} info metric in weighted scores`).toBe(true);

      const weightTotal = Object.values(resolved.metric_weights).reduce((sum, weight) => sum + weight, 0);
      if (weightedMetricIds.length > 0) {
        expect(weightTotal).toBeGreaterThan(0.999);
        expect(weightTotal).toBeLessThan(1.001);
      }
    });
  });
});
