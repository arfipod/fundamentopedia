import type { MetricCategory, ProfileRoot, ScoringRule } from '../../types';
import { resolveGicsProfile } from '../../data/profileResolver';
import { matchMetricKeyFromLabel, type MetricKey } from '../financials/metricAliases';
import type { EffectiveMetricProfile, EffectiveProfile, GrowthRule } from './effectiveProfileTypes';

function normalizeLevel(level: string): 'sector' | 'industryGroup' | 'industry' | 'subIndustry' {
  if (level === 'industry_group') return 'industryGroup';
  if (level === 'sub_industry') return 'subIndustry';
  if (level === 'industry') return 'industry';
  return 'sector';
}

function prettifyMetricId(metricId: string): string {
  return metricId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function metricKeyFromProfileMetric(metricId: string): MetricKey | null {
  const direct = matchMetricKeyFromLabel(metricId);
  if (direct) return direct;

  if (metricId.includes('revenue_cagr')) return 'revenueCagr';
  if (metricId.includes('eps_cagr')) return 'epsCagr';
  if (metricId.includes('gross_profit_cagr')) return 'grossProfitCagr';
  if (metricId.includes('fcf_cagr')) return 'fcfCagr';
  return null;
}

function thresholdsFromRule(rule: ScoringRule): GrowthRule['thresholds'] {
  if (rule.type === 'higher_better') {
    return {
      bull: rule.bull_min ?? undefined,
      neutral: rule.neutral_min ?? undefined,
      bear: rule.bear_max ?? undefined,
    };
  }

  if (rule.type === 'lower_better') {
    return {
      bull: rule.bull_max ?? undefined,
      neutral: rule.neutral_max ?? undefined,
      bear: rule.bear_min ?? undefined,
    };
  }

  if (rule.type === 'target_range') {
    return {
      bull: rule.bull_max,
      neutral: rule.neutral_max,
    };
  }

  return undefined;
}

function inferRuleKind(metricId: string, unit?: string): GrowthRule['kind'] {
  if (metricId.includes('cagr')) return 'cagr';
  if (metricId.includes('growth') || metricId.includes('yoy')) return 'yoy';
  if (metricId.includes('margin') || unit === '%') return 'margin';
  return 'level';
}

function toGrowthRule(metricId: string, rule: ScoringRule): GrowthRule | null {
  if (rule.type === 'informational') return null;

  return {
    kind: inferRuleKind(metricId, rule.unit),
    direction: rule.type === 'lower_better' ? 'lowerIsBetter' : 'higherIsBetter',
    thresholds: thresholdsFromRule(rule),
    notes: rule.note,
  };
}

function detectSupport(metricId: string): EffectiveMetricProfile['supports'] {
  if (metricId.includes('cagr')) {
    return { cagr: true, windows: [3, 5, 10] };
  }
  if (metricId.includes('growth') || metricId.includes('margin')) {
    return { cagr: false, windows: [] };
  }
  return undefined;
}

function buildLineage(profile: ProfileRoot, path: string[]): { level: string; code: string; name: string }[] {
  const byCode = new Map<string, { level: string; name: string }>();
  const walk = (nodes: ProfileRoot['gics_tree']) => {
    for (const node of nodes) {
      byCode.set(node.code, { level: normalizeLevel(node.level), name: node.name_es });
      if (node.children?.length) walk(node.children);
    }
  };
  walk(profile.gics_tree);

  return path
    .map((code) => {
      const node = byCode.get(code);
      if (!node) return null;
      return { level: node.level, code, name: node.name };
    })
    .filter((entry): entry is { level: string; code: string; name: string } => entry !== null);
}

function buildOverrides(path: string[], metricIdByKey: Map<MetricKey, string>, profile: ProfileRoot): Record<string, string[]> {
  const nodesByCode = new Map<string, ProfileRoot['gics_tree'][number]>();
  const walk = (nodes: ProfileRoot['gics_tree']) => {
    for (const node of nodes) {
      nodesByCode.set(node.code, node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(profile.gics_tree);

  const overrides: Record<string, string[]> = {};
  for (const [metricKey, metricId] of metricIdByKey.entries()) {
    const fields = new Set<string>();
    for (const code of path) {
      const node = nodesByCode.get(code);
      if (!node) continue;
      if (node.scoring?.threshold_overrides?.[metricId]) fields.add('rules.thresholds');
      if (node.overrides?.add_core?.includes(metricId) || node.overrides?.add_secondary?.includes(metricId) || node.overrides?.add_risk?.includes(metricId)) {
        fields.add('priority');
      }
      if (node.overrides?.remove?.includes(metricId)) fields.add('priority');
    }
    if (fields.size > 0) overrides[metricKey] = [...fields];
  }
  return overrides;
}

export function resolveEffectiveProfile(profile: ProfileRoot, code: string): EffectiveProfile | null {
  const resolved = resolveGicsProfile(profile, code, { recomputeFromGraph: true });
  if (!resolved) return null;

  const lineage = buildLineage(profile, resolved.path);
  const metrics: Partial<Record<MetricKey, EffectiveMetricProfile>> = {};
  const metricIdByKey = new Map<MetricKey, string>();

  for (const [metricId, priorityMeta] of Object.entries(resolved.kpi_priorities)) {
    const metricKey = metricKeyFromProfileMetric(metricId);
    if (!metricKey || metrics[metricKey]) continue;

    const rule = resolved.threshold_overrides?.[metricId] ?? profile.scoring_rules[metricId];
    const library = profile.metric_library[metricId];

    metrics[metricKey] = {
      key: metricKey,
      priority: priorityMeta.category as MetricCategory,
      weight: resolved.metric_weights[metricId] ?? resolved.bucketed_weights[metricId],
      commentary: {
        title: prettifyMetricId(metricId),
        definition: library?.why,
        whatToWatch: library?.watch_for,
        unitsHint: rule?.unit,
      },
      rules: rule ? [toGrowthRule(metricId, rule)].filter((entry): entry is GrowthRule => entry !== null) : undefined,
      supports: detectSupport(metricId),
    };

    metricIdByKey.set(metricKey, metricId);
  }

  const groups: Array<{ id: string; title: string; metricKeys: MetricKey[] }> = [];
  (['core', 'risk', 'secondary'] as MetricCategory[]).forEach((category) => {
    const keys = Object.values(metrics)
      .filter((metric): metric is EffectiveMetricProfile => Boolean(metric) && metric.priority === category)
      .map((metric) => metric.key);

    if (keys.length > 0) {
      groups.push({
        id: category,
        title: category === 'core' ? 'Core' : category === 'risk' ? 'Risk' : 'Secondary',
        metricKeys: keys,
      });
    }
  });

  return {
    gics: {
      level: normalizeLevel(resolved.level),
      code: resolved.code,
      name: resolved.name_es,
      lineage,
    },
    metrics: metrics as Record<MetricKey, EffectiveMetricProfile>,
    ui: groups.length > 0 ? { groups } : undefined,
    provenance: {
      mergedFrom: lineage,
      overrides: buildOverrides(resolved.path, metricIdByKey, profile),
    },
  };
}
