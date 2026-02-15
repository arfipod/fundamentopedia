import type {
  BucketWeightMap,
  GicsProfileIndexNode,
  GicsTreeNode,
  MetricCategory,
  MetricPriorityMap,
  MetricWeightMap,
  ProfileRoot,
  ResolvedGicsProfile,
  TreeWatchlist,
} from '../types';
import { migrateAndResolveGicsCode } from './gicsCodeMigration';

const CATEGORY_ORDER: MetricCategory[] = ['core', 'risk', 'secondary'];

interface ResolverOptions {
  recomputeFromGraph?: boolean;
}

interface TreeIndexes {
  nodeByCode: Map<string, GicsTreeNode>;
  pathByCode: Map<string, string[]>;
}

interface ResolvedState {
  templates: string[];
  watchlist: TreeWatchlist;
}

function buildTreeIndexes(profile: ProfileRoot): TreeIndexes {
  const nodeByCode = new Map<string, GicsTreeNode>();
  const pathByCode = new Map<string, string[]>();

  const walk = (nodes: GicsTreeNode[], path: string[]) => {
    for (const node of nodes) {
      const nodePath = [...path, node.code];
      nodeByCode.set(node.code, node);
      pathByCode.set(node.code, nodePath);
      if (node.children?.length) {
        walk(node.children, nodePath);
      }
    }
  };

  walk(profile.gics_tree, []);
  return { nodeByCode, pathByCode };
}

function toWatchlistFromPriorities(metricPriorities: MetricPriorityMap): TreeWatchlist {
  const watchlist: TreeWatchlist = { core: [], risk: [], secondary: [] };
  const sorted = Object.entries(metricPriorities).sort((a, b) => a[1].priority - b[1].priority);
  for (const [metricId, priority] of sorted) {
    watchlist[priority.category].push(metricId);
  }
  return watchlist;
}

function normalizeWatchlist(watchlist: TreeWatchlist): TreeWatchlist {
  const core = new Set(watchlist.core);
  const risk = new Set(watchlist.risk.filter((metricId) => !core.has(metricId)));
  const secondary = new Set(watchlist.secondary.filter((metricId) => !core.has(metricId) && !risk.has(metricId)));
  return {
    core: [...core],
    risk: [...risk],
    secondary: [...secondary],
  };
}

function buildMetricPriorities(watchlist: TreeWatchlist): MetricPriorityMap {
  const metricPriorities: MetricPriorityMap = {};
  let priority = 1;
  for (const category of CATEGORY_ORDER) {
    for (const metricId of watchlist[category]) {
      metricPriorities[metricId] = { category, priority };
      priority += 1;
    }
  }
  return metricPriorities;
}

function buildBucketWeights(profile: ProfileRoot, templates: string[]): BucketWeightMap {
  const merged: BucketWeightMap = { ...profile.scorecard_config.bucket_weights_default };
  for (const templateId of templates) {
    const templateWeights = profile.scorecard_config.bucket_weights_by_template[templateId] ?? {};
    Object.assign(merged, templateWeights);
  }
  return merged;
}

function isInformationalMetric(profile: ProfileRoot, metricId: string, templates: string[], node: GicsTreeNode): boolean {
  let rule = profile.scoring_rules[metricId];
  for (const templateId of templates) {
    const templateOverride = profile.scorecard_config.threshold_overrides_by_template[templateId]?.[metricId];
    if (templateOverride) {
      rule = templateOverride;
    }
  }
  if (node.scoring?.threshold_overrides?.[metricId]) {
    rule = node.scoring.threshold_overrides[metricId];
  }
  return rule?.type === 'informational' || node.scoring?.informational_metrics?.includes(metricId) === true;
}

function buildWeights(
  profile: ProfileRoot,
  metricPriorities: MetricPriorityMap,
  templates: string[],
  node: GicsTreeNode,
): { metricWeights: MetricWeightMap; informationalMetrics: string[]; bucketedWeights: MetricWeightMap; bucketWeights: BucketWeightMap } {
  const informationalMetrics: string[] = [];
  const weightByPriority = profile.weight_by_priority_default ?? {};
  const rawWeights: MetricWeightMap = {};

  for (const [metricId, priority] of Object.entries(metricPriorities)) {
    if (isInformationalMetric(profile, metricId, templates, node)) {
      informationalMetrics.push(metricId);
      continue;
    }
    rawWeights[metricId] = Number(weightByPriority[String(priority.priority)] ?? 0);
  }

  const rawTotal = Object.values(rawWeights).reduce((sum, value) => sum + value, 0);
  const metricWeights: MetricWeightMap = {};
  for (const [metricId, value] of Object.entries(rawWeights)) {
    metricWeights[metricId] = rawTotal > 0 ? value / rawTotal : 0;
  }

  const bucketWeights = buildBucketWeights(profile, templates);
  const byBucket = new Map<string, string[]>();
  for (const metricId of Object.keys(metricWeights)) {
    const bucketId = profile.scorecard_config.metric_bucket_map[metricId] ?? 'unassigned';
    byBucket.set(bucketId, [...(byBucket.get(bucketId) ?? []), metricId]);
  }

  const bucketedWeights: MetricWeightMap = {};
  for (const [bucketId, metricIds] of byBucket.entries()) {
    const bucketWeight = bucketWeights[bucketId] ?? 0;
    const bucketTotal = metricIds.reduce((sum, metricId) => sum + metricWeights[metricId], 0);
    for (const metricId of metricIds) {
      const withinBucket = bucketTotal > 0 ? metricWeights[metricId] / bucketTotal : 0;
      bucketedWeights[metricId] = bucketWeight * withinBucket;
    }
  }

  return { metricWeights, informationalMetrics, bucketedWeights, bucketWeights };
}

function applyNodeState(profile: ProfileRoot, node: GicsTreeNode, parentState?: ResolvedState): ResolvedState {
  const templates = [...(parentState?.templates ?? [])];
  const watchlist: TreeWatchlist = {
    core: [...(parentState?.watchlist.core ?? [])],
    risk: [...(parentState?.watchlist.risk ?? [])],
    secondary: [...(parentState?.watchlist.secondary ?? [])],
  };

  for (const templateId of node.applies_templates ?? []) {
    templates.push(templateId);
    const template = profile.templates[templateId];
    if (!template) continue;
    watchlist.core.push(...template.core);
    watchlist.risk.push(...template.risk);
    watchlist.secondary.push(...template.secondary);
  }

  watchlist.core.push(...(node.overrides?.add_core ?? []));
  watchlist.risk.push(...(node.overrides?.add_risk ?? []));
  watchlist.secondary.push(...(node.overrides?.add_secondary ?? []));

  const removed = new Set(node.overrides?.remove ?? []);
  const cleaned = normalizeWatchlist({
    core: watchlist.core.filter((metricId) => !removed.has(metricId)),
    risk: watchlist.risk.filter((metricId) => !removed.has(metricId)),
    secondary: watchlist.secondary.filter((metricId) => !removed.has(metricId)),
  });

  return {
    templates,
    watchlist: cleaned,
  };
}

function fromIndex(code: string, indexNode: GicsProfileIndexNode): ResolvedGicsProfile {
  return {
    code,
    level: indexNode.level,
    name_es: indexNode.name_es,
    path: indexNode.path_es,
    templates: indexNode.applies_templates,
    watchlist: toWatchlistFromPriorities(indexNode.metric_priorities),
    kpi_priorities: indexNode.metric_priorities,
    metric_weights: indexNode.metric_weights,
    informational_metrics: indexNode.informational_metrics,
    bucketed_weights: indexNode.metric_weights_bucketed,
    bucket_weights: indexNode.bucket_weights,
    threshold_overrides: indexNode.threshold_overrides,
  };
}

function fromTree(profile: ProfileRoot, code: string, indexes: TreeIndexes): ResolvedGicsProfile | null {
  const targetNode = indexes.nodeByCode.get(code);
  const path = indexes.pathByCode.get(code);
  if (!targetNode || !path) return null;

  let resolved: ResolvedState | undefined;
  for (const pathCode of path) {
    const node = indexes.nodeByCode.get(pathCode);
    if (!node) continue;
    resolved = applyNodeState(profile, node, resolved);
  }

  if (!resolved) return null;
  const watchlist = normalizeWatchlist(resolved.watchlist);
  const kpiPriorities = buildMetricPriorities(watchlist);
  const weights = buildWeights(profile, kpiPriorities, resolved.templates, targetNode);

  return {
    code,
    level: targetNode.level,
    name_es: targetNode.name_es,
    path,
    templates: resolved.templates,
    watchlist,
    kpi_priorities: kpiPriorities,
    metric_weights: weights.metricWeights,
    informational_metrics: weights.informationalMetrics,
    bucketed_weights: weights.bucketedWeights,
    bucket_weights: weights.bucketWeights,
  };
}

export function resolveGicsProfile(profile: ProfileRoot, code: string, options: ResolverOptions = {}): ResolvedGicsProfile | null {
  const treeIndexes = buildTreeIndexes(profile);
  const knownCodes = new Set([...treeIndexes.nodeByCode.keys(), ...Object.keys(profile.gics_profile_index)]);
  const resolvedCode = migrateAndResolveGicsCode(code, knownCodes);
  if (!resolvedCode) return null;

  if (!options.recomputeFromGraph && profile.gics_profile_index[resolvedCode]) {
    return fromIndex(resolvedCode, profile.gics_profile_index[resolvedCode]);
  }

  const recomputed = fromTree(profile, resolvedCode, treeIndexes);
  if (recomputed) return recomputed;

  if (profile.gics_profile_index[resolvedCode]) {
    return fromIndex(resolvedCode, profile.gics_profile_index[resolvedCode]);
  }
  return null;
}

export function resolveGeneralProfile(profile: ProfileRoot): ResolvedGicsProfile | null {
  const templateId = profile.templates.base_nonfinancial ? 'base_nonfinancial' : null;
  if (!templateId) return null;

  const template = profile.templates[templateId];
  const watchlist = normalizeWatchlist({
    core: [...template.core],
    risk: [...template.risk],
    secondary: [...template.secondary],
  });
  const kpiPriorities = buildMetricPriorities(watchlist);
  const weights = buildWeights(
    profile,
    kpiPriorities,
    [templateId],
    {
      code: 'general',
      level: 'sector',
      name_es: 'General',
    },
  );

  return {
    code: 'general',
    level: 'sector',
    name_es: 'General',
    path: [],
    templates: [templateId],
    watchlist,
    kpi_priorities: kpiPriorities,
    metric_weights: weights.metricWeights,
    informational_metrics: weights.informationalMetrics,
    bucketed_weights: weights.bucketedWeights,
    bucket_weights: weights.bucketWeights,
  };
}
