import type { ProfileRoot, ResolvedGicsProfile } from '../types';
import { useI18n } from '../i18n/i18n';
import { buildNodeMarkdown, formatPct } from './utils';
import { MetricTable } from './MetricTable';

interface Props {
  code: string;
  node: ResolvedGicsProfile;
  profile: ProfileRoot;
  breadcrumbCodes: string[];
}

export function NodeDetail({ code, node, profile, breadcrumbCodes }: Props) {
  const { t } = useI18n();
  const displayName = t(`gics.name.${code}`, node.name_es);
  const breadcrumbNames = breadcrumbCodes.map((c) => t(`gics.name.${c}`, profile.gics_profile_index[c]?.name_es ?? c));

  const copyMarkdown = async () => {
    const md = buildNodeMarkdown({ code, name: displayName, node, profile, breadcrumbs: breadcrumbNames });
    await navigator.clipboard.writeText(md);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(node, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h4 className="mb-1">{displayName}</h4>
            <span className="badge text-bg-secondary me-1">{code}</span>
            <span className="badge text-bg-info">{t(`gics.level.${node.level}`, node.level)}</span>
            <div className="mt-2 text-muted small">{breadcrumbNames.join(' > ')}</div>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void copyMarkdown()}>
              {t('ui.actions.copy_markdown', 'Copy summary as Markdown')}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={downloadJson}>
              {t('ui.actions.download_json', 'Download node JSON')}
            </button>
          </div>
        </div>

        <hr />

        <div className="alert alert-light border">
          <h6 className="mb-1">{t('profile.inheritance.title', 'GICS profile inheritance')}</h6>
          <div className="small text-muted mb-1">{t('profile.inheritance.subtitle', 'Directed graph inheritance')}</div>
          <div className="small mb-1">{t('profile.inheritance.description', 'Children inherit defaults and can add, override, or remove metrics.')}</div>
          <div className="small"><strong>{t('profile.inheritance.rule.dedupe', 'Category dedupe rule: core > risk > secondary.')}</strong></div>
        </div>

        <hr />

        <h5>{t('ui.sections.templates', 'Templates')}</h5>
        <div className="mb-2 d-flex flex-wrap gap-1">
          {node.templates.map((templateId) => (
            <span className="badge text-bg-dark" key={templateId}>{templateId}</span>
          ))}
        </div>
        {node.templates.map((templateId) => (
          <p className="small mb-1" key={`${templateId}-note`}>
            <strong>{templateId}:</strong> {t(`template.notes.${templateId}`, profile.templates[templateId]?.notes ?? '')}
          </p>
        ))}

        <hr />

        <h5>{t('ui.sections.buckets', 'Scorecard Buckets')}</h5>
        <div className="row">
          {profile.scorecard_config.buckets.map((bucket) => {
            const weight = node.bucket_weights[bucket.id] ?? 0;
            return (
              <div className="col-md-6 mb-2" key={bucket.id}>
                <div className="d-flex justify-content-between">
                  <span>{t(`bucket.label.${bucket.id}`, bucket.label_es)}</span>
                  <span>{formatPct(weight)}</span>
                </div>
                <div className="progress" role="progressbar" aria-valuenow={weight * 100} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-bar" style={{ width: `${weight * 100}%` }} />
                </div>
                <div className="small text-muted">{t(`bucket.desc.${bucket.id}`, bucket.description_es)}</div>
              </div>
            );
          })}
        </div>

        <hr />
        <h5>{t('ui.sections.metrics', 'Metrics')}</h5>
        <MetricTable code={code} node={node} profile={profile} />
      </div>
    </div>
  );
}
