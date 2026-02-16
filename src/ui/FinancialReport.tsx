import { useState } from 'react';
import type { ComputedMetric, FinancialReport, MetricGroup, ReportSummary } from '../financials/types';
import { formatPeriodLabel } from '../financials/calculator';

interface Props {
  report: FinancialReport;
}

function fmtNum(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined) return '—';
  if (unit === 'percent') return `${(v * 100).toFixed(1)}%`;
  if (unit === 'ratio') return v.toFixed(2) + 'x';
  if (unit === 'currency') {
    // Format with thousand separators
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}k`;
    if (Math.abs(v) >= 1_000) return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return v.toFixed(2);
  }
  if (Math.abs(v) >= 1_000) return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
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

function MetricGroupTable({ group, allPeriods }: { group: MetricGroup; allPeriods: string[] }) {
  const [expanded, setExpanded] = useState(true);

  // Find periods that have at least one non-null value across all metrics in the group
  const activePeriods = allPeriods.filter((p) =>
    group.metrics.some((m) => m.values[p] !== null && m.values[p] !== undefined),
  );

  // Show at most 10 most recent periods
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
                  <th className="position-sticky start-0 bg-light" style={{ minWidth: 200 }}>Metric</th>
                  {displayPeriods.map((p) => (
                    <th key={p} className="text-end text-nowrap" style={{ minWidth: 90 }}>
                      {formatPeriodLabel(p)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.metrics.map((metric) => (
                  <MetricRow key={metric.label} metric={metric} periods={displayPeriods} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricRow({ metric, periods }: { metric: ComputedMetric; periods: string[] }) {
  return (
    <tr>
      <td className="position-sticky start-0 bg-white" title={metric.description}>
        <span className="fw-medium">{metric.label}</span>
        {metric.description && (
          <div className="text-muted" style={{ fontSize: '0.7rem' }}>{metric.description}</div>
        )}
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

export function FinancialReportView({ report }: Props) {
  return (
    <div>
      <SummaryCard summary={report.summary} header={report.header} />

      {report.analysis.map((group) => (
        <MetricGroupTable key={group.title} group={group} allPeriods={report.periods} />
      ))}

      <hr />
      <h5 className="mb-3">Raw Parsed Data</h5>
      {Object.entries(report.sections).map(([key, section]) => (
        <RawSectionTable key={key} name={section.name} section={section} />
      ))}
    </div>
  );
}
