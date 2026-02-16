import { useMemo, useState } from 'react';
import type { ComputedMetric, FinancialReport, MetricGroup, ReportSummary } from '../financials/types';
import { formatPeriodLabel } from '../financials/calculator';
import { matchMetricKeyFromLabel, type MetricKey } from '../domain/financials/metricAliases';
import type { EffectiveMetricProfile, EffectiveProfile, GrowthRule, Signal } from '../domain/gics/effectiveProfileTypes';

interface Props {
  report: FinancialReport;
  effectiveProfile?: EffectiveProfile | null;
}

function fmtNum(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined) return '—';
  if (unit === 'percent') return `${(v * 100).toFixed(1)}%`;
  if (unit === 'ratio') return v.toFixed(2) + 'x';
  if (unit === 'currency') {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}k`;
    if (Math.abs(v) >= 1_000) return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return v.toFixed(2);
  }
  if (Math.abs(v) >= 1_000) return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function cagr(start: number | null | undefined, end: number | null | undefined, years: number): number | null {
  if (start === null || start === undefined || end === null || end === undefined || years <= 0 || start <= 0 || end <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

function computeMetricCagr(metric: ComputedMetric, periods: string[], years: number): number | null {
  const annualPeriods = periods.filter((p) => p !== 'LTM');
  // Find the last annual period with actual data for this metric
  let endIdx = annualPeriods.length - 1;
  while (endIdx >= 0 && metric.values[annualPeriods[endIdx]] == null) {
    endIdx--;
  }
  const startIdx = endIdx - years;
  if (startIdx < 0) return null;
  return cagr(metric.values[annualPeriods[startIdx]], metric.values[annualPeriods[endIdx]], years);
}

function formatThreshold(v?: number, unit?: string): string {
  if (v === undefined) return '—';
  if (unit === 'percent' || unit === '%' || !unit) return `${(v * 100).toFixed(1)}%`;
  if (unit === 'turns' || unit === 'ratio') return `${v.toFixed(2)}x`;
  return v.toFixed(2);
}

function describeRule(rule: GrowthRule): string {
  const direction = rule.direction === 'lowerIsBetter' ? '↓ better' : '↑ better';
  const prefix = rule.kind.toUpperCase();
  const hasThresholds = Boolean(rule.thresholds && (rule.thresholds.bull !== undefined || rule.thresholds.neutral !== undefined || rule.thresholds.bear !== undefined));

  if (!hasThresholds) return `${prefix} (${direction})`;

  const u = rule.unit;
  return `${prefix}: Bull ${rule.direction === 'lowerIsBetter' ? '<=' : '>='} ${formatThreshold(rule.thresholds?.bull, u)} · Neutral ${rule.direction === 'lowerIsBetter' ? '<=' : '>='} ${formatThreshold(rule.thresholds?.neutral, u)} · Bear ${rule.direction === 'lowerIsBetter' ? '>=' : '<='} ${formatThreshold(rule.thresholds?.bear, u)}`;
}

function evaluateRule(rule: GrowthRule, value: number | null): Signal {
  if (value === null || value === undefined || !rule.thresholds) return 'na';

  const { bull, neutral, bear } = rule.thresholds;
  if (rule.direction === 'lowerIsBetter') {
    if (bull !== undefined && value <= bull) return 'bull';
    if (neutral !== undefined && value <= neutral) return 'neutral';
    if (bear !== undefined && value >= bear) return 'bear';
    if (neutral !== undefined) return value > neutral ? 'bear' : 'neutral';
    return 'na';
  }

  if (bull !== undefined && value >= bull) return 'bull';
  if (neutral !== undefined && value >= neutral) return 'neutral';
  if (bear !== undefined && value <= bear) return 'bear';
  if (neutral !== undefined) return value < neutral ? 'bear' : 'neutral';
  return 'na';
}

function signalBadgeClass(signal: Signal): string {
  if (signal === 'bull') return 'text-bg-success';
  if (signal === 'neutral') return 'text-bg-warning';
  if (signal === 'bear') return 'text-bg-danger';
  return 'text-bg-secondary';
}

function inferMetricKey(metric: ComputedMetric): MetricKey | null {
  const byAlias = matchMetricKeyFromLabel(metric.label);
  if (byAlias) return byAlias;

  const lower = metric.label.toLowerCase();
  if (lower.includes('revenue yoy') || lower.includes('revenue growth')) return 'revenue';
  if (lower.includes('gross margin')) return 'grossMargin';
  if (lower.includes('operating margin')) return 'operatingMargin';
  if (lower.includes('net margin')) return 'netMargin';
  if (lower.includes('free cash flow') || lower.includes('fcf')) return 'freeCashFlow';
  if (lower.includes('roic')) return 'roic';
  if (lower.includes('roe')) return 'roe';
  if (lower.includes('roa')) return 'roa';
  if (lower.includes('inventory')) return 'inventory';
  if (lower.includes('net debt')) return 'netDebt';
  return null;
}

function preferredRuleKind(metric: ComputedMetric): GrowthRule['kind'] {
  const lower = metric.label.toLowerCase();
  if (lower.includes('cagr')) return 'cagr';
  if (lower.includes('yoy') || lower.includes('growth')) return 'yoy';
  if (lower.includes('margin')) return 'margin';
  return 'level';
}

function findRelevantRule(profile: EffectiveMetricProfile | undefined, metric: ComputedMetric): GrowthRule | null {
  if (!profile?.rules?.length) return null;
  const preferred = preferredRuleKind(metric);
  return profile.rules.find((r) => r.kind === preferred) ?? profile.rules[0] ?? null;
}

function SummaryCard({ summary, header }: { summary: ReportSummary; header: FinancialReport['header'] }) {
  const ticker = header.ticker || 'Company';
  const company = header.companyName || '';

  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
          <div>
            <h3 className="mb-0">{ticker}{company ? ` — ${company}` : ''}</h3>
            <div className="text-muted small">
              {header.currency && header.price !== null
                ? `Price: ${header.currency}$${fmtNum(header.price, 'currency')}`
                : ''}
              {header.extractedAt ? ` | ${header.extractedAt}` : ''}
              {header.period ? ` | ${header.period}` : ''}
            </div>
          </div>
          <span className="badge bg-primary fs-6">Latest: {summary.latestPeriod}</span>
        </div>

        <div className="row g-3">
          <SummaryItem label="Revenue" value={summary.revenueLatest} unit="currency" />
          <SummaryItem label="Net Income" value={summary.netIncomeLatest} unit="currency" />
          <SummaryItem label="EPS" value={summary.epsLatest} unit="currency" />
          <SummaryItem label="Gross Margin" value={summary.grossMarginLatest} unit="percent" />
          <SummaryItem label="Operating Margin" value={summary.operatingMarginLatest} unit="percent" />
          <SummaryItem label="Net Margin" value={summary.netMarginLatest} unit="percent" />
          <SummaryItem label="Rev. CAGR 3Y" value={summary.revenueCAGR3Y} unit="percent" />
          <SummaryItem label="Rev. CAGR 5Y" value={summary.revenueCAGR5Y} unit="percent" />
          <SummaryItem label="NI CAGR 3Y" value={summary.netIncomeCAGR3Y} unit="percent" />
          <SummaryItem label="ROE" value={summary.roe} unit="percent" />
          <SummaryItem label="ROA" value={summary.roa} unit="percent" />
          <SummaryItem label="Current Ratio" value={summary.currentRatio} unit="ratio" />
          <SummaryItem label="Debt / Equity" value={summary.debtToEquity} unit="ratio" />
          <SummaryItem label="Net Debt / EBITDA" value={summary.netDebtToEBITDA} unit="ratio" />
          <SummaryItem label="FCF Margin" value={summary.fcfMargin} unit="percent" />
          <SummaryItem label="P/E Ratio" value={summary.peRatio} unit="ratio" />
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value === null) return null;
  const colorClass = unit === 'percent' && value !== null
    ? value > 0 ? 'text-success' : value < 0 ? 'text-danger' : ''
    : '';
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="border rounded p-2 h-100">
        <div className="text-muted small">{label}</div>
        <div className={`fw-semibold fs-6 ${colorClass}`}>{fmtNum(value, unit)}</div>
      </div>
    </div>
  );
}

function MetricGroupTable({
  group,
  allPeriods,
  effectiveProfile,
  cagrWindowYears,
}: {
  group: MetricGroup;
  allPeriods: string[];
  effectiveProfile?: EffectiveProfile | null;
  cagrWindowYears: number;
}) {
  const [expanded, setExpanded] = useState(true);

  const activePeriods = allPeriods.filter((p) =>
    group.metrics.some((m) => m.values[p] !== null && m.values[p] !== undefined),
  );
  const displayPeriods = activePeriods.slice(-10);

  return (
    <div className="card mb-3">
      <div
        className="card-header d-flex justify-content-between align-items-center"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded((e) => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((x) => !x); }}
      >
        <h5 className="mb-0">{group.title}</h5>
        <span>{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expanded && (
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-striped table-sm table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="position-sticky start-0 bg-light" style={{ minWidth: 280 }}>Metric + quality criteria</th>
                  {displayPeriods.map((p) => (
                    <th key={p} className="text-end text-nowrap" style={{ minWidth: 90 }}>
                      {formatPeriodLabel(p)}
                    </th>
                  ))}
                  <th className="text-end text-nowrap" style={{ minWidth: 110 }}>CAGR {cagrWindowYears}Y</th>
                  <th className="text-nowrap" style={{ minWidth: 90 }}>Signal</th>
                </tr>
              </thead>
              <tbody>
                {group.metrics.map((metric) => (
                  <MetricRow
                    key={metric.label}
                    metric={metric}
                    periods={displayPeriods}
                    allPeriods={allPeriods}
                    cagrWindowYears={cagrWindowYears}
                    effectiveProfile={effectiveProfile}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricRow({
  metric,
  periods,
  allPeriods,
  cagrWindowYears,
  effectiveProfile,
}: {
  metric: ComputedMetric;
  periods: string[];
  allPeriods: string[];
  cagrWindowYears: number;
  effectiveProfile?: EffectiveProfile | null;
}) {
  const metricKey = inferMetricKey(metric);
  const profileMetric = metricKey ? effectiveProfile?.metrics[metricKey] : undefined;
  const relevantRule = findRelevantRule(profileMetric, metric);

  const latestPeriod = periods[periods.length - 1];
  const latestValue = latestPeriod ? metric.values[latestPeriod] ?? null : null;
  const cagrValue = computeMetricCagr(metric, allPeriods, cagrWindowYears);

  const shouldShowCagr = profileMetric?.supports?.cagr === true
    || (metricKey !== null && ['revenue', 'freeCashFlow', 'netIncome', 'epsBasic', 'epsDiluted', 'grossProfit'].includes(metricKey));

  const ruleInputValue = relevantRule?.kind === 'cagr' ? cagrValue : latestValue;
  const signal = relevantRule ? evaluateRule(relevantRule, ruleInputValue) : 'na';

  return (
    <tr>
      <td className="position-sticky start-0 bg-white" title={metric.description}>
        <div className="fw-medium">{metric.label}</div>
        {metric.description && (
          <div className="text-muted" style={{ fontSize: '0.7rem' }}>{metric.description}</div>
        )}
        <div className="small mt-1">
          {profileMetric?.rules?.length ? (
            profileMetric.rules.map((rule, idx) => (
              <div key={`${metric.label}-rule-${idx}`} className="text-muted">• {describeRule(rule)}</div>
            ))
          ) : (
            <div className="text-muted">• No GICS quality criteria mapped for this metric.</div>
          )}
        </div>
      </td>
      {periods.map((p) => {
        const v = metric.values[p];
        const colorClass =
          metric.unit === 'percent' && v !== null && v !== undefined
            ? v > 0 ? 'text-success' : v < 0 ? 'text-danger' : ''
            : '';
        return (
          <td key={p} className={`text-end text-nowrap ${colorClass}`}>
            {fmtNum(v, metric.unit)}
          </td>
        );
      })}
      <td className="text-end text-nowrap">{shouldShowCagr ? fmtNum(cagrValue, 'percent') : '—'}</td>
      <td>
        <span className={`badge ${signalBadgeClass(signal)}`}>{signal.toUpperCase()}</span>
      </td>
    </tr>
  );
}

function RawSectionTable({ name, section }: { name: string; section: FinancialReport['sections'][string] }) {
  const [expanded, setExpanded] = useState(false);
  const displayPeriods = section.periods.slice(-10);

  return (
    <div className="card mb-3">
      <div
        className="card-header d-flex justify-content-between align-items-center"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded((e) => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((x) => !x); }}
      >
        <h6 className="mb-0">{name} (raw data)</h6>
        <span>{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expanded && (
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-striped table-sm table-hover mb-0 align-middle" style={{ fontSize: '0.8rem' }}>
              <thead className="table-light">
                <tr>
                  <th className="position-sticky start-0 bg-light" style={{ minWidth: 220 }}>Line Item</th>
                  {displayPeriods.map((p) => (
                    <th key={p} className="text-end text-nowrap">{formatPeriodLabel(p)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.label}>
                    <td className="position-sticky start-0 bg-white">{row.label}</td>
                    {displayPeriods.map((p) => {
                      const v = row.values[p];
                      const neg = v !== null && v !== undefined && v < 0;
                      return (
                        <td key={p} className={`text-end text-nowrap ${neg ? 'text-danger' : ''}`}>
                          {v === null || v === undefined ? '' : fmtNum(v, 'number')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinancialReportView({ report, effectiveProfile }: Props) {
  const [cagrWindowYears, setCagrWindowYears] = useState(3);
  const profileLabel = useMemo(
    () => (effectiveProfile ? `${effectiveProfile.gics.name} (${effectiveProfile.gics.code})` : 'General profile (no GICS)'),
    [effectiveProfile],
  );

  return (
    <div>
      <SummaryCard summary={report.summary} header={report.header} />

      <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
        <div>
          <label htmlFor="cagr-window" className="form-label mb-1 fw-semibold">CAGR window</label>
          <select
            id="cagr-window"
            className="form-select"
            value={cagrWindowYears}
            onChange={(e) => setCagrWindowYears(Number(e.target.value))}
          >
            <option value={3}>3 years</option>
            <option value={5}>5 years</option>
            <option value={10}>10 years</option>
          </select>
        </div>
        <div className="small text-muted pb-2">
          Active quality profile: <strong>{profileLabel}</strong>
        </div>
      </div>

      {report.analysis.map((group) => (
        <MetricGroupTable
          key={group.title}
          group={group}
          allPeriods={report.periods}
          effectiveProfile={effectiveProfile}
          cagrWindowYears={cagrWindowYears}
        />
      ))}

      <hr />
      <h5 className="mb-3">Raw Parsed Data</h5>
      {Object.entries(report.sections).map(([key, section]) => (
        <RawSectionTable key={key} name={section.name} section={section} />
      ))}
    </div>
  );
}
