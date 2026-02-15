import type { MetricCategory, ProfileRoot, ResolvedGicsProfile } from '../types';

export const LEVEL_ORDER = ['sector', 'industry_group', 'industry', 'sub_industry'] as const;

export function formatPct(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function categoryBadgeClass(category: MetricCategory): string {
  if (category === 'core') return 'bg-success';
  if (category === 'secondary') return 'bg-primary';
  return 'bg-warning text-dark';
}

/** Keys shown as the rule header (type + unit), separated from threshold values. */
const SCORING_META_KEYS = new Set(['type', 'unit', 'note']);

export function scoringRuleToText(rule: Record<string, unknown> | undefined): string {
  if (!rule) return '—';
  const type = rule.type ? String(rule.type) : '';
  const unit = rule.unit ? ` (${String(rule.unit)})` : '';
  const thresholds = Object.entries(rule)
    .filter(([k, v]) => !SCORING_META_KEYS.has(k) && v != null)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
  return thresholds ? `${type}${unit} — ${thresholds}` : `${type}${unit}`;
}

export function buildNodeMarkdown(args: {
  code: string;
  name: string;
  node: ResolvedGicsProfile;
  profile: ProfileRoot;
  breadcrumbs: string[];
}): string {
  const { code, name, node, profile, breadcrumbs } = args;
  const lines: string[] = [];
  lines.push(`# ${name} (${code})`);
  lines.push('');
  lines.push(`- Level: ${node.level}`);
  lines.push(`- Breadcrumb: ${breadcrumbs.join(' > ')}`);
  lines.push(`- Templates: ${node.templates.join(', ') || 'None'}`);
  lines.push('');
  lines.push('## Buckets');
  lines.push('| Bucket | Weight |');
  lines.push('|---|---:|');
  for (const bucket of profile.scorecard_config.buckets) {
    lines.push(`| ${bucket.label_es} | ${formatPct(node.bucket_weights[bucket.id])} |`);
  }
  lines.push('');
  lines.push('## Metrics');
  lines.push('| Metric | Category | Priority | Bucket | Weight |');
  lines.push('|---|---|---:|---|---:|');

  const metricRows = Object.entries(node.kpi_priorities).sort((a, b) => a[1].priority - b[1].priority);
  for (const [metricId, mp] of metricRows) {
    const metric = profile.metric_library[metricId];
    const bucket = profile.scorecard_config.metric_bucket_map[metricId] ?? '—';
    lines.push(
      `| ${metric?.label_es ?? metricId} | ${mp.category} | ${mp.priority} | ${bucket} | ${formatPct(node.bucketed_weights[metricId])} |`,
    );
  }

  return lines.join('\n');
}
