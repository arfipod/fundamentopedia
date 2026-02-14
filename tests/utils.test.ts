import { describe, expect, it } from 'vitest';
import { buildNodeMarkdown, categoryBadgeClass, formatPct, scoringRuleToText } from '../src/ui/utils';
import type { GicsProfileIndexNode, ProfileRoot } from '../src/types';

describe('utils', () => {
  it('formatPct formats numeric values', () => {
    expect(formatPct(0.123)).toBe('12.3%');
    expect(formatPct(undefined)).toBe('—');
  });

  it('categoryBadgeClass maps categories', () => {
    expect(categoryBadgeClass('core')).toContain('success');
    expect(categoryBadgeClass('secondary')).toContain('primary');
    expect(categoryBadgeClass('risk')).toContain('warning');
  });

  it('scoringRuleToText serializes rule objects', () => {
    expect(scoringRuleToText(undefined)).toBe('—');
    expect(scoringRuleToText({ type: 'higher_better', bull_min: 10 })).toContain('bull_min: 10');
  });

  it('buildNodeMarkdown produces markdown table content', () => {
    const node: GicsProfileIndexNode = {
      level: 'industry',
      name_es: 'Test Industry',
      path_es: ['Energy', 'Test Industry'],
      applies_templates: ['base_nonfinancial'],
      metric_priorities: { m1: { priority: 1, category: 'core' } },
      metric_weights: { m1: 1 },
      metric_weights_bucketed: { m1: 0.2 },
      informational_metrics: [],
      bucket_weights: { quality: 0.5 },
      bucket_metric_weights: {},
    };

    const profile = {
      metric_library: { m1: { label_es: 'Metric 1', statement: 'income', why: 'Because' } },
      scorecard_config: {
        buckets: [{ id: 'quality', label_es: 'Quality', description_es: 'Desc' }],
        metric_bucket_map: { m1: 'quality' },
      },
    } as unknown as ProfileRoot;

    const markdown = buildNodeMarkdown({
      code: '1010',
      name: 'Test Industry',
      node,
      profile,
      breadcrumbs: ['Energy', 'Test Industry'],
    });

    expect(markdown).toContain('# Test Industry (1010)');
    expect(markdown).toContain('## Buckets');
    expect(markdown).toContain('| Metric 1 | core | 1 | quality | 20.0% |');
  });
});
