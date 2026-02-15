import { useMemo, useState } from 'react';
import type { ProfileRoot, ResolvedGicsProfile } from '../types';
import { useI18n } from '../i18n/i18n';
import { categoryBadgeClass, formatPct, scoringRuleToText } from './utils';

interface Props {
  code: string;
  node: ResolvedGicsProfile;
  profile: ProfileRoot;
}

const tabs = ['core', 'secondary', 'risk', 'all'] as const;
type MetricTab = (typeof tabs)[number];

export function MetricTable({ code, node, profile }: Props) {
  const [activeTab, setActiveTab] = useState<MetricTab>('all');
  const { t } = useI18n();

  const rows = useMemo(() => {
    const base = Object.entries(node.kpi_priorities)
      .map(([metricId, priority]) => ({ metricId, priority }))
      .sort((a, b) => a.priority.priority - b.priority.priority || a.metricId.localeCompare(b.metricId));

    return base.filter((row) => (activeTab === 'all' ? true : row.priority.category === activeTab));
  }, [activeTab, node.kpi_priorities]);

  return (
    <>
      <ul className="nav nav-tabs mb-2">
        {tabs.map((tab) => (
          <li className="nav-item" key={tab}>
            <button
              type="button"
              className={`nav-link ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {t(`ui.tabs.${tab}`, tab.toUpperCase())}
            </button>
          </li>
        ))}
      </ul>

      <div className="table-responsive">
        <table className="table table-striped table-sm align-middle">
          <thead>
            <tr>
              <th>Metric</th><th>Priority</th><th>Category</th><th>Bucket</th><th>Weight</th><th>Statement</th><th>Why</th><th>Watch for</th><th>Scoring</th><th>Override</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ metricId, priority }) => {
              const metric = profile.metric_library[metricId];
              const bucketId = profile.scorecard_config.metric_bucket_map[metricId] ?? '';
              const bucket = profile.scorecard_config.buckets.find((b) => b.id === bucketId);
              const scoring = profile.scoring_rules[metricId];
              const override = node.threshold_overrides?.[metricId];

              return (
                <tr key={metricId}>
                  <td>
                    <div className="fw-semibold">{t(`metric.label.${metricId}`, metric?.label_es ?? metricId)}</div>
                    <div className="text-muted small">{metricId}</div>
                  </td>
                  <td>{priority.priority}</td>
                  <td><span className={`badge ${categoryBadgeClass(priority.category)}`}>{priority.category}</span></td>
                  <td>{t(`bucket.label.${bucketId}`, bucket?.label_es ?? bucketId)}</td>
                  <td>{formatPct(node.bucketed_weights[metricId])}</td>
                  <td>{t(`ui.statement.${metric?.statement ?? ''}`, metric?.statement ?? '—')}</td>
                  <td>{t(`metric.why.${metricId}`, metric?.why ?? '')}</td>
                  <td>{t(`metric.watch_for.${metricId}`, metric?.watch_for ?? '')}</td>
                  <td>
                    <div>{scoringRuleToText(scoring as unknown as Record<string, unknown>)}</div>
                    <div className="text-muted small">{t(`scoring.note.${metricId}`, scoring?.note ?? '')}</div>
                  </td>
                  <td>
                    {override ? (
                      <>
                        <div>{scoringRuleToText(override as unknown as Record<string, unknown>)}</div>
                        <div className="text-muted small">{t(`override.note.${code}.${metricId}`, override.note ?? '')}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
