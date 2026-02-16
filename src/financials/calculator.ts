import type {
  CellValue,
  ComputedMetric,
  FinancialReport,
  FinancialSection,
  MetricGroup,
  ParsedFinancials,
  ReportSummary,
} from './types';
import { findRow, findRowByMetricKey, getRowValue } from './parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute CAGR given start and end values and number of years. */
function cagr(start: number | null, end: number | null, years: number): number | null {
  if (!start || !end || years <= 0 || start <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

/** Year-over-year growth. */
function yoyGrowth(prev: number | null, curr: number | null): number | null {
  if (prev === null || curr === null || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
}

/** Safe division. */
function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

/** Get the last N non-LTM periods from a list. */
function getAnnualPeriods(periods: string[]): string[] {
  return periods.filter((p) => p !== 'LTM');
}

/** Find the index of the last annual period where the row has non-null data. */
function findLastDataIndex(row: { values: Record<string, CellValue> } | undefined, periods: string[]): number {
  if (!row) return -1;
  for (let i = periods.length - 1; i >= 0; i--) {
    if (row.values[periods[i]] != null) return i;
  }
  return -1;
}

/** Get overlapping annual periods across all provided sections. */
function getCommonPeriods(parsed: ParsedFinancials): string[] {
  const allPeriods = new Set<string>();
  for (const section of Object.values(parsed.sections)) {
    for (const p of section.periods) {
      if (p !== 'LTM') allPeriods.add(p);
    }
  }
  // Sort chronologically (DD/MM/YY format)
  return [...allPeriods].sort((a, b) => {
    const da = parseDatePeriod(a);
    const db = parseDatePeriod(b);
    return da - db;
  });
}

/** Parse a date string like "30/09/06" or "24/09/16" to a timestamp for sorting. */
function parseDatePeriod(s: string): number {
  const parts = s.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    return new Date(year, month, day).getTime();
  }
  // Try other formats
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Format a period label for display. */
export function formatPeriodLabel(s: string): string {
  if (s === 'LTM') return 'LTM';
  const parts = s.split('/');
  if (parts.length === 3) {
    let year = parseInt(parts[2], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    return `${parts[1]}/${year}`;
  }
  // Actuals & estimates labels like "31/12/24 A" or "31/12/25 E"
  return s;
}

// ---------------------------------------------------------------------------
// Metric extraction helpers
// ---------------------------------------------------------------------------

function buildMetricFromRow(
  section: FinancialSection | undefined,
  periods: string[],
  label: string,
  unit: 'number' | 'percent' | 'ratio' | 'currency',
  description: string,
  ...patterns: string[]
): ComputedMetric | null {
  const row = findRow(section, ...patterns);
  if (!row) return null;
  const values: Record<string, number | null> = {};
  for (const p of periods) {
    values[p] = row.values[p] ?? null;
  }
  return { label, values, unit, description };
}

function computeSeriesMetric(
  periods: string[],
  label: string,
  unit: 'number' | 'percent' | 'ratio' | 'currency',
  description: string,
  computeFn: (period: string) => number | null,
): ComputedMetric {
  const values: Record<string, number | null> = {};
  for (const p of periods) {
    values[p] = computeFn(p);
  }
  return { label, values, unit, description };
}

// ---------------------------------------------------------------------------
// Main analysis engine
// ---------------------------------------------------------------------------

export function analyzeFinancials(parsed: ParsedFinancials): FinancialReport {
  const is = parsed.sections['income_statement'];
  const bs = parsed.sections['balance_sheet'];
  const cf = parsed.sections['cash_flow'];
  const ratios = parsed.sections['ratios'];
  const valuation = parsed.sections['valuation_multiples'];

  const allPeriods = getCommonPeriods(parsed);
  const annualPeriods = getAnnualPeriods(allPeriods);
  // Include LTM if available
  const periodsWithLTM = is?.periods.includes('LTM')
    ? [...annualPeriods, 'LTM']
    : annualPeriods;

  const analysis: MetricGroup[] = [];

  // ========================================
  // 1. Profitability Analysis
  // ========================================
  const profitabilityMetrics: ComputedMetric[] = [];

  const revenueRow = findRowByMetricKey(is, 'revenue') ?? findRow(is, 'total revenues', 'revenues');
  const grossProfitRow = findRowByMetricKey(is, 'grossProfit') ?? findRow(is, 'gross profit');
  const opIncomeRow = findRowByMetricKey(is, 'operatingIncome') ?? findRow(is, 'operating income');
  const netIncomeRow = findRowByMetricKey(is, 'netIncome') ?? findRow(is, 'net income to common incl extra', 'net income');
  const ebitdaRow = findRowByMetricKey(is, 'ebitda') ?? findRow(is, 'ebitda');

  if (revenueRow) {
    profitabilityMetrics.push({
      label: 'Revenue',
      values: filterPeriods(revenueRow.values, periodsWithLTM),
      unit: 'currency',
      description: 'Total revenues',
    });
  }

  // Revenue YoY Growth
  if (revenueRow) {
    profitabilityMetrics.push(
      computeSeriesMetric(annualPeriods, 'Revenue YoY Growth', 'percent', 'Year-over-year revenue growth', (p) => {
        const idx = annualPeriods.indexOf(p);
        if (idx <= 0) return null;
        return yoyGrowth(revenueRow.values[annualPeriods[idx - 1]] ?? null, revenueRow.values[p] ?? null);
      }),
    );
  }

  // Gross Margin
  profitabilityMetrics.push(
    computeSeriesMetric(periodsWithLTM, 'Gross Margin', 'percent', 'Gross Profit / Revenue', (p) =>
      safeDiv(grossProfitRow?.values[p] ?? null, revenueRow?.values[p] ?? null),
    ),
  );

  // Operating Margin
  profitabilityMetrics.push(
    computeSeriesMetric(periodsWithLTM, 'Operating Margin', 'percent', 'Operating Income / Revenue', (p) =>
      safeDiv(opIncomeRow?.values[p] ?? null, revenueRow?.values[p] ?? null),
    ),
  );

  // Net Margin
  profitabilityMetrics.push(
    computeSeriesMetric(periodsWithLTM, 'Net Margin', 'percent', 'Net Income / Revenue', (p) =>
      safeDiv(netIncomeRow?.values[p] ?? null, revenueRow?.values[p] ?? null),
    ),
  );

  // EBITDA Margin
  if (ebitdaRow && revenueRow) {
    profitabilityMetrics.push(
      computeSeriesMetric(periodsWithLTM, 'EBITDA Margin', 'percent', 'EBITDA / Revenue', (p) =>
        safeDiv(ebitdaRow.values[p] ?? null, revenueRow.values[p] ?? null),
      ),
    );
  }

  if (profitabilityMetrics.length > 0) {
    analysis.push({ title: 'Profitability Analysis', metrics: profitabilityMetrics });
  }

  // ========================================
  // 2. Growth Analysis
  // ========================================
  const growthMetrics: ComputedMetric[] = [];

  const revLastIdx = findLastDataIndex(revenueRow, annualPeriods);
  if (revenueRow && revLastIdx >= 3) {
    const last = annualPeriods[revLastIdx];
    const threeBack = annualPeriods[revLastIdx - 3];
    const cagrVal = cagr(revenueRow.values[threeBack] ?? null, revenueRow.values[last] ?? null, 3);
    if (cagrVal !== null) {
      growthMetrics.push({
        label: 'Revenue CAGR (3Y)',
        values: { [last]: cagrVal },
        unit: 'percent',
        description: '3-year compound annual growth rate of revenue',
      });
    }
  }

  if (revenueRow && revLastIdx >= 5) {
    const last = annualPeriods[revLastIdx];
    const fiveBack = annualPeriods[revLastIdx - 5];
    const cagrVal = cagr(revenueRow.values[fiveBack] ?? null, revenueRow.values[last] ?? null, 5);
    if (cagrVal !== null) {
      growthMetrics.push({
        label: 'Revenue CAGR (5Y)',
        values: { [last]: cagrVal },
        unit: 'percent',
        description: '5-year compound annual growth rate of revenue',
      });
    }
  }

  if (netIncomeRow) {
    growthMetrics.push(
      computeSeriesMetric(annualPeriods, 'Net Income YoY Growth', 'percent', 'Year-over-year net income growth', (p) => {
        const idx = annualPeriods.indexOf(p);
        if (idx <= 0) return null;
        return yoyGrowth(netIncomeRow.values[annualPeriods[idx - 1]] ?? null, netIncomeRow.values[p] ?? null);
      }),
    );
  }

  const niLastIdx = findLastDataIndex(netIncomeRow, annualPeriods);
  if (netIncomeRow && niLastIdx >= 3) {
    const last = annualPeriods[niLastIdx];
    const threeBack = annualPeriods[niLastIdx - 3];
    const cagrVal = cagr(netIncomeRow.values[threeBack] ?? null, netIncomeRow.values[last] ?? null, 3);
    if (cagrVal !== null) {
      growthMetrics.push({
        label: 'Net Income CAGR (3Y)',
        values: { [last]: cagrVal },
        unit: 'percent',
        description: '3-year compound annual growth rate of net income',
      });
    }
  }

  // EPS Growth
  const epsRow = findRow(is, 'diluted eps excl extra');
  if (epsRow) {
    growthMetrics.push(
      computeSeriesMetric(annualPeriods, 'Diluted EPS YoY Growth', 'percent', 'Year-over-year EPS growth', (p) => {
        const idx = annualPeriods.indexOf(p);
        if (idx <= 0) return null;
        return yoyGrowth(epsRow.values[annualPeriods[idx - 1]] ?? null, epsRow.values[p] ?? null);
      }),
    );
  }

  // EBITDA Growth
  if (ebitdaRow) {
    growthMetrics.push(
      computeSeriesMetric(annualPeriods, 'EBITDA YoY Growth', 'percent', 'Year-over-year EBITDA growth', (p) => {
        const idx = annualPeriods.indexOf(p);
        if (idx <= 0) return null;
        return yoyGrowth(ebitdaRow.values[annualPeriods[idx - 1]] ?? null, ebitdaRow.values[p] ?? null);
      }),
    );
  }

  if (growthMetrics.length > 0) {
    analysis.push({ title: 'Growth Analysis', metrics: growthMetrics });
  }

  // ========================================
  // 3. Return Analysis
  // ========================================
  const returnMetrics: ComputedMetric[] = [];

  const totalEquityRow = findRow(bs, 'total common equity', 'total equity');
  const totalAssetsRow = findRow(bs, 'total assets');

  // ROE
  if (netIncomeRow && totalEquityRow) {
    returnMetrics.push(
      computeSeriesMetric(annualPeriods, 'Return on Equity (ROE)', 'percent', 'Net Income / Total Equity', (p) =>
        safeDiv(netIncomeRow.values[p] ?? null, totalEquityRow.values[p] ?? null),
      ),
    );
  }

  // ROA
  if (netIncomeRow && totalAssetsRow) {
    returnMetrics.push(
      computeSeriesMetric(annualPeriods, 'Return on Assets (ROA)', 'percent', 'Net Income / Total Assets', (p) =>
        safeDiv(netIncomeRow.values[p] ?? null, totalAssetsRow.values[p] ?? null),
      ),
    );
  }

  // ROIC = NOPAT / Invested Capital
  const totalDebtRow = findRow(bs, 'total debt');
  if (opIncomeRow && totalEquityRow && totalDebtRow) {
    const taxRateRow = findRow(is, 'effective tax rate');
    returnMetrics.push(
      computeSeriesMetric(annualPeriods, 'Return on Invested Capital (ROIC)', 'percent',
        'NOPAT / (Total Equity + Total Debt)', (p) => {
          const opIncome = opIncomeRow.values[p] ?? null;
          const equity = totalEquityRow.values[p] ?? null;
          const debt = totalDebtRow.values[p] ?? null;
          if (opIncome === null || equity === null || debt === null) return null;
          // Tax rate from row or default 25%
          let taxRate = taxRateRow?.values[p] ?? null;
          // If tax rate is already in decimal (e.g. 0.256 from parseNumber),
          // use it directly; if it was a whole number like 25.6, divide
          if (taxRate !== null && taxRate > 1) taxRate = taxRate / 100;
          const effectiveTax = taxRate ?? 0.25;
          const nopat = opIncome * (1 - effectiveTax);
          const investedCapital = equity + Math.abs(debt);
          return investedCapital === 0 ? null : nopat / investedCapital;
        },
      ),
    );
  }

  // Return from existing ratios section if available
  const roaRatio = buildMetricFromRow(ratios, annualPeriods, 'ROA (from ratios)', 'percent',
    'Return on Assets from ratios section', 'return on assets');
  if (roaRatio) returnMetrics.push(roaRatio);

  const roeRatio = buildMetricFromRow(ratios, annualPeriods, 'ROE (from ratios)', 'percent',
    'Return on Equity from ratios section', 'return on equity', 'return on common equity');
  if (roeRatio) returnMetrics.push(roeRatio);

  if (returnMetrics.length > 0) {
    analysis.push({ title: 'Return Analysis', metrics: returnMetrics });
  }

  // ========================================
  // 4. Balance Sheet / Solvency Analysis
  // ========================================
  const solvencyMetrics: ComputedMetric[] = [];

  const currentAssetsRow = findRow(bs, 'total current assets');
  const currentLiabRow = findRow(bs, 'total current liabilities');
  const totalLiabRow = findRow(bs, 'total liabilities');
  const netDebtRow = findRow(bs, 'net debt');
  const inventoryRow = findRow(bs, 'inventory');

  // Current Ratio
  if (currentAssetsRow && currentLiabRow) {
    solvencyMetrics.push(
      computeSeriesMetric(annualPeriods, 'Current Ratio', 'ratio', 'Current Assets / Current Liabilities', (p) =>
        safeDiv(currentAssetsRow.values[p] ?? null, currentLiabRow.values[p] ?? null),
      ),
    );
  }

  // Quick Ratio
  if (currentAssetsRow && inventoryRow && currentLiabRow) {
    solvencyMetrics.push(
      computeSeriesMetric(annualPeriods, 'Quick Ratio', 'ratio',
        '(Current Assets - Inventory) / Current Liabilities', (p) => {
          const ca = currentAssetsRow.values[p];
          const inv = inventoryRow.values[p] ?? 0;
          const cl = currentLiabRow.values[p];
          if (ca === null || ca === undefined || cl === null || cl === undefined || cl === 0) return null;
          return (ca - (inv ?? 0)) / cl;
        },
      ),
    );
  }

  // Debt to Equity
  if (totalDebtRow && totalEquityRow) {
    solvencyMetrics.push(
      computeSeriesMetric(annualPeriods, 'Debt / Equity', 'ratio', 'Total Debt / Total Equity', (p) =>
        safeDiv(totalDebtRow.values[p] ?? null, totalEquityRow.values[p] ?? null),
      ),
    );
  }

  // Total Liabilities / Total Assets
  if (totalLiabRow && totalAssetsRow) {
    solvencyMetrics.push(
      computeSeriesMetric(annualPeriods, 'Liabilities / Assets', 'percent', 'Total Liabilities / Total Assets', (p) =>
        safeDiv(totalLiabRow.values[p] ?? null, totalAssetsRow.values[p] ?? null),
      ),
    );
  }

  // Net Debt / EBITDA
  if (netDebtRow && ebitdaRow) {
    solvencyMetrics.push(
      computeSeriesMetric(annualPeriods, 'Net Debt / EBITDA', 'ratio', 'Net Debt / EBITDA', (p) =>
        safeDiv(netDebtRow.values[p] ?? null, ebitdaRow.values[p] ?? null),
      ),
    );
  }

  // Interest Coverage
  if (opIncomeRow) {
    const interestRow = findRow(is, 'interest expense');
    if (interestRow) {
      solvencyMetrics.push(
        computeSeriesMetric(annualPeriods, 'Interest Coverage', 'ratio',
          'Operating Income / Interest Expense', (p) => {
            const opInc = opIncomeRow.values[p] ?? null;
            const interest = interestRow.values[p] ?? null;
            if (opInc === null || interest === null || interest === 0) return null;
            return opInc / Math.abs(interest);
          },
        ),
      );
    }
  }

  if (solvencyMetrics.length > 0) {
    analysis.push({ title: 'Balance Sheet & Solvency', metrics: solvencyMetrics });
  }

  // ========================================
  // 5. Cash Flow Analysis
  // ========================================
  const cfMetrics: ComputedMetric[] = [];

  const cfoRow = findRow(cf, 'cash from operations');
  const capexRow = findRow(cf, 'capital expenditure');
  const fcfRow = findRow(cf, 'free cash flow');

  if (cfoRow) {
    cfMetrics.push({
      label: 'Cash from Operations',
      values: filterPeriods(cfoRow.values, annualPeriods),
      unit: 'currency',
      description: 'Operating cash flow',
    });
  }

  if (fcfRow) {
    cfMetrics.push({
      label: 'Free Cash Flow',
      values: filterPeriods(fcfRow.values, annualPeriods),
      unit: 'currency',
      description: 'Free cash flow (CFO - CapEx)',
    });
  }

  // FCF Margin
  if (fcfRow && revenueRow) {
    cfMetrics.push(
      computeSeriesMetric(annualPeriods, 'FCF Margin', 'percent', 'Free Cash Flow / Revenue', (p) =>
        safeDiv(fcfRow.values[p] ?? null, revenueRow.values[p] ?? null),
      ),
    );
  }

  // Cash Conversion (FCF / Net Income)
  if (fcfRow && netIncomeRow) {
    cfMetrics.push(
      computeSeriesMetric(annualPeriods, 'Cash Conversion', 'percent', 'FCF / Net Income', (p) =>
        safeDiv(fcfRow.values[p] ?? null, netIncomeRow.values[p] ?? null),
      ),
    );
  }

  // CapEx / Revenue
  if (capexRow && revenueRow) {
    cfMetrics.push(
      computeSeriesMetric(annualPeriods, 'CapEx / Revenue', 'percent', 'Capital Expenditure / Revenue', (p) => {
        const cap = capexRow.values[p] ?? null;
        const rev = revenueRow.values[p] ?? null;
        if (cap === null || rev === null || rev === 0) return null;
        return Math.abs(cap) / rev;
      }),
    );
  }

  // FCF Growth
  if (fcfRow) {
    cfMetrics.push(
      computeSeriesMetric(annualPeriods, 'FCF YoY Growth', 'percent', 'Year-over-year free cash flow growth', (p) => {
        const idx = annualPeriods.indexOf(p);
        if (idx <= 0) return null;
        return yoyGrowth(fcfRow.values[annualPeriods[idx - 1]] ?? null, fcfRow.values[p] ?? null);
      }),
    );
  }

  if (cfMetrics.length > 0) {
    analysis.push({ title: 'Cash Flow Analysis', metrics: cfMetrics });
  }

  // ========================================
  // 6. Per-Share Analysis
  // ========================================
  const perShareMetrics: ComputedMetric[] = [];

  if (epsRow) {
    perShareMetrics.push({
      label: 'Diluted EPS',
      values: filterPeriods(epsRow.values, periodsWithLTM),
      unit: 'currency',
      description: 'Diluted earnings per share (excl. extra items)',
    });
  }

  const dpsRow = findRow(is, 'dividends per share');
  if (dpsRow) {
    perShareMetrics.push({
      label: 'Dividends Per Share',
      values: filterPeriods(dpsRow.values, periodsWithLTM),
      unit: 'currency',
      description: 'Dividends paid per share',
    });
  }

  const payoutRow = findRow(is, 'payout ratio');
  if (payoutRow) {
    perShareMetrics.push({
      label: 'Payout Ratio',
      values: filterPeriods(payoutRow.values, periodsWithLTM),
      unit: 'percent',
      description: 'Dividends per share / EPS',
    });
  }

  const bvpsRow = findRow(bs, 'book value / share', 'book value per share');
  if (bvpsRow) {
    perShareMetrics.push({
      label: 'Book Value / Share',
      values: filterPeriods(bvpsRow.values, annualPeriods),
      unit: 'currency',
      description: 'Equity per share',
    });
  }

  const sharesRow = findRow(is, 'weighted average diluted shares');
  if (sharesRow) {
    perShareMetrics.push({
      label: 'Diluted Shares Outstanding',
      values: filterPeriods(sharesRow.values, annualPeriods),
      unit: 'number',
      description: 'Weighted average diluted shares outstanding',
    });

    // Buyback yield
    perShareMetrics.push(
      computeSeriesMetric(annualPeriods, 'Share Count Change YoY', 'percent', 'Change in diluted shares outstanding', (p) => {
        const idx = annualPeriods.indexOf(p);
        if (idx <= 0) return null;
        return yoyGrowth(sharesRow.values[annualPeriods[idx - 1]] ?? null, sharesRow.values[p] ?? null);
      }),
    );
  }

  if (perShareMetrics.length > 0) {
    analysis.push({ title: 'Per-Share Data', metrics: perShareMetrics });
  }

  // ========================================
  // 7. Efficiency / DuPont Analysis
  // ========================================
  const dupontMetrics: ComputedMetric[] = [];

  // Net Profit Margin (already computed above, but include for DuPont completeness)
  // Asset Turnover = Revenue / Total Assets
  if (revenueRow && totalAssetsRow) {
    dupontMetrics.push(
      computeSeriesMetric(annualPeriods, 'Asset Turnover', 'ratio', 'Revenue / Total Assets', (p) =>
        safeDiv(revenueRow.values[p] ?? null, totalAssetsRow.values[p] ?? null),
      ),
    );
  }

  // Equity Multiplier = Total Assets / Total Equity
  if (totalAssetsRow && totalEquityRow) {
    dupontMetrics.push(
      computeSeriesMetric(annualPeriods, 'Equity Multiplier', 'ratio', 'Total Assets / Total Equity (leverage)', (p) =>
        safeDiv(totalAssetsRow.values[p] ?? null, totalEquityRow.values[p] ?? null),
      ),
    );
  }

  if (dupontMetrics.length > 0) {
    analysis.push({ title: 'DuPont / Efficiency', metrics: dupontMetrics });
  }

  // ========================================
  // 8. Valuation (if available)
  // ========================================
  if (valuation) {
    const valMetrics: ComputedMetric[] = [];
    const valPeriods = valuation.periods;

    const addValMetric = (unit: 'number' | 'percent' | 'ratio' | 'currency', ...patterns: string[]) => {
      const m = buildMetricFromRow(valuation, valPeriods, patterns[0], unit, patterns[0], ...patterns);
      if (m) valMetrics.push(m);
    };

    addValMetric('ratio', 'NTM P/E', 'ntm price / normalized earnings');
    addValMetric('ratio', 'NTM EV/EBITDA', 'ntm total enterprise value / ebitda');
    addValMetric('ratio', 'NTM EV/Revenue', 'ntm total enterprise value / revenues');
    addValMetric('percent', 'NTM FCF Yield', 'ntm levered free cash flow yield');
    addValMetric('ratio', 'LTM P/E', 'ltm price / diluted eps');
    addValMetric('ratio', 'LTM EV/EBITDA', 'ltm total enterprise value / ebitda');
    addValMetric('ratio', 'LTM P/B', 'ltm price / book value');
    addValMetric('percent', 'LTM Dividend Yield', 'ltm dividend yield');

    if (valMetrics.length > 0) {
      analysis.push({ title: 'Valuation Multiples', metrics: valMetrics });
    }
  }

  // ========================================
  // Build Summary
  // ========================================
  // Use the last period with actual revenue data (avoids estimate-only future periods)
  const summaryRevIdx = findLastDataIndex(revenueRow, annualPeriods);
  const latestPeriod = summaryRevIdx >= 0 ? annualPeriods[summaryRevIdx] : (annualPeriods[annualPeriods.length - 1] ?? '');
  const prevPeriods3 = summaryRevIdx >= 3 ? annualPeriods[summaryRevIdx - 3] : null;
  const prevPeriods5 = summaryRevIdx >= 5 ? annualPeriods[summaryRevIdx - 5] : null;

  const revLatest = revenueRow?.values[latestPeriod] ?? null;
  const niLatest = netIncomeRow?.values[latestPeriod] ?? null;

  const summary: ReportSummary = {
    latestPeriod,
    revenueLatest: revLatest,
    netIncomeLatest: niLatest,
    grossMarginLatest: safeDiv(grossProfitRow?.values[latestPeriod] ?? null, revLatest),
    operatingMarginLatest: safeDiv(opIncomeRow?.values[latestPeriod] ?? null, revLatest),
    netMarginLatest: safeDiv(niLatest, revLatest),
    revenueCAGR3Y: prevPeriods3 ? cagr(revenueRow?.values[prevPeriods3] ?? null, revLatest, 3) : null,
    revenueCAGR5Y: prevPeriods5 ? cagr(revenueRow?.values[prevPeriods5] ?? null, revLatest, 5) : null,
    netIncomeCAGR3Y: prevPeriods3 ? cagr(netIncomeRow?.values[prevPeriods3] ?? null, niLatest, 3) : null,
    netIncomeCAGR5Y: prevPeriods5 ? cagr(netIncomeRow?.values[prevPeriods5] ?? null, niLatest, 5) : null,
    roe: safeDiv(niLatest, totalEquityRow?.values[latestPeriod] ?? null),
    roa: safeDiv(niLatest, totalAssetsRow?.values[latestPeriod] ?? null),
    currentRatio: safeDiv(currentAssetsRow?.values[latestPeriod] ?? null, currentLiabRow?.values[latestPeriod] ?? null),
    debtToEquity: safeDiv(totalDebtRow?.values[latestPeriod] ?? null, totalEquityRow?.values[latestPeriod] ?? null),
    netDebtToEBITDA: safeDiv(netDebtRow?.values[latestPeriod] ?? null, ebitdaRow?.values[latestPeriod] ?? null),
    fcfMargin: safeDiv(fcfRow?.values[latestPeriod] ?? null, revLatest),
    fcfYield: null,
    dividendYield: null,
    epsLatest: epsRow?.values[latestPeriod] ?? null,
    peRatio: null,
  };

  // Try to get valuation-based summary items
  if (valuation) {
    const valPeriods = valuation.periods;
    const latestValPeriod = valPeriods[valPeriods.length - 1] ?? '';
    summary.fcfYield = getRowValue(valuation, latestValPeriod, 'ntm levered free cash flow yield');
    summary.dividendYield = getRowValue(valuation, latestValPeriod, 'ltm dividend yield', 'ntm dividend yield');
    summary.peRatio = getRowValue(valuation, latestValPeriod, 'ntm price / normalized earnings', 'ltm price / diluted eps');
  }

  return {
    header: parsed.header,
    sections: parsed.sections,
    analysis,
    periods: periodsWithLTM,
    summary,
  };
}

/** Filter a values map to only include specified periods. */
function filterPeriods(values: Record<string, CellValue>, periods: string[]): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const p of periods) {
    result[p] = values[p] ?? null;
  }
  return result;
}
