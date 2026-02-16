/** Parsed header from the TIKR markdown */
export interface FinancialHeader {
  ticker: string;
  companyName: string;
  price: number | null;
  currency: string;
  extractedAt: string;
  period: string;
}

/** A single cell value – may be a number, percentage, string, or null */
export type CellValue = number | null;

/** One row in a financial table (line item name -> period -> value) */
export interface FinancialRow {
  label: string;
  values: Record<string, CellValue>;
}

/** A complete financial section (e.g. Income Statement) */
export interface FinancialSection {
  name: string;
  periods: string[];
  rows: FinancialRow[];
}

/** All sections parsed from a markdown document */
export interface ParsedFinancials {
  header: FinancialHeader;
  sections: Record<string, FinancialSection>;
}

/** Types of sections we recognise */
export type SectionKey =
  | 'income_statement'
  | 'balance_sheet'
  | 'cash_flow'
  | 'ratios'
  | 'valuation_multiples'
  | 'analyst_price_targets'
  | 'consensus_estimates';

/** Mapping from markdown heading text to our internal key */
export const SECTION_HEADING_MAP: Record<string, SectionKey> = {
  'income statement': 'income_statement',
  'balance sheet': 'balance_sheet',
  'cash flow': 'cash_flow',
  'cash flow statement': 'cash_flow',
  ratios: 'ratios',
  'valuation multiples': 'valuation_multiples',
  'analyst price targets': 'analyst_price_targets',
  'consensus estimates': 'consensus_estimates',
};

/** A single computed metric for one period */
export interface ComputedMetric {
  label: string;
  values: Record<string, number | null>;
  unit: 'number' | 'percent' | 'ratio' | 'currency';
  description?: string;
}

/** A group of computed metrics */
export interface MetricGroup {
  title: string;
  metrics: ComputedMetric[];
}

/** Full financial report output */
export interface FinancialReport {
  header: FinancialHeader;
  sections: Record<string, FinancialSection>;
  analysis: MetricGroup[];
  periods: string[];
  summary: ReportSummary;
}

/** High-level summary for the report */
export interface ReportSummary {
  latestPeriod: string;
  revenueLatest: number | null;
  netIncomeLatest: number | null;
  grossMarginLatest: number | null;
  operatingMarginLatest: number | null;
  netMarginLatest: number | null;
  revenueCAGR3Y: number | null;
  revenueCAGR5Y: number | null;
  netIncomeCAGR3Y: number | null;
  netIncomeCAGR5Y: number | null;
  roe: number | null;
  roa: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  netDebtToEBITDA: number | null;
  fcfMargin: number | null;
  fcfYield: number | null;
  dividendYield: number | null;
  epsLatest: number | null;
  peRatio: number | null;
}
