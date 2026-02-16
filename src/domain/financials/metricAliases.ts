export type MetricKey =
  | 'revenue'
  | 'cogs'
  | 'grossProfit'
  | 'grossMargin'
  | 'rdExpense'
  | 'sgaExpense'
  | 'operatingExpense'
  | 'operatingIncome'
  | 'operatingMargin'
  | 'ebit'
  | 'ebitMargin'
  | 'ebitda'
  | 'ebitdaMargin'
  | 'depreciationAmortization'
  | 'interestExpense'
  | 'pretaxIncome'
  | 'taxExpense'
  | 'netIncome'
  | 'netMargin'
  | 'epsBasic'
  | 'epsDiluted'
  | 'sharesBasic'
  | 'sharesDiluted'
  | 'operatingCashFlow'
  | 'capex'
  | 'freeCashFlow'
  | 'freeCashFlowMargin'
  | 'dividendsPaid'
  | 'shareBuybacks'
  | 'netIssuanceOfStock'
  | 'debtIssued'
  | 'debtRepaid'
  | 'cashAndEquivalents'
  | 'shortTermInvestments'
  | 'totalCash'
  | 'totalAssets'
  | 'totalLiabilities'
  | 'totalEquity'
  | 'totalDebt'
  | 'netDebt'
  | 'currentAssets'
  | 'currentLiabilities'
  | 'workingCapital'
  | 'inventory'
  | 'accountsReceivable'
  | 'accountsPayable'
  | 'roic'
  | 'roe'
  | 'roa'
  | 'grossProfitCagr'
  | 'revenueCagr'
  | 'epsCagr'
  | 'fcfCagr';

export function normalizeMetricLabel(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\p{L}\p{N}%\s.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const METRIC_ALIASES: Record<MetricKey, string[]> = {
  revenue: ['revenue', 'revenues', 'total revenue', 'net sales', 'sales', 'total revenues', 'sales revenue', 'turnover'],
  cogs: ['cost of revenue', 'cost of revenues', 'cost of goods sold', 'cogs', 'cost of sales'],
  grossProfit: ['gross profit'],
  grossMargin: ['gross margin', 'gross profit margin'],
  rdExpense: ['research and development', 'research and development expense', 'r and d', 'r&d', 'rd expense'],
  sgaExpense: ['selling general and administrative', 'selling general and administrative expense', 'sg and a', 'sg&a', 'sga'],
  operatingExpense: ['operating expenses', 'total operating expenses'],
  operatingIncome: ['operating income', 'operating profit', 'income from operations', 'operating earnings'],
  operatingMargin: ['operating margin', 'operating income margin'],
  ebit: ['ebit', 'earnings before interest and taxes'],
  ebitMargin: ['ebit margin'],
  ebitda: ['ebitda', 'earnings before interest taxes depreciation and amortization'],
  ebitdaMargin: ['ebitda margin'],
  depreciationAmortization: ['depreciation and amortization', 'depreciation & amortization', 'd and a', 'd&a', 'depreciation amortization'],
  interestExpense: ['interest expense', 'net interest expense'],
  pretaxIncome: ['pretax income', 'income before tax', 'income before taxes'],
  taxExpense: ['income tax expense', 'tax expense', 'provision for income taxes'],
  netIncome: [
    'net income',
    'net earnings',
    'net profit',
    'profit attributable to shareholders',
    'net income to common',
    'net income attributable to common shareholders',
  ],
  netMargin: ['net margin', 'net income margin'],
  epsBasic: ['eps basic', 'basic eps', 'earnings per share basic'],
  epsDiluted: ['eps diluted', 'diluted eps', 'diluted eps excl extra items', 'earnings per share diluted'],
  sharesBasic: ['weighted average shares basic', 'shares basic', 'weighted avg shares basic'],
  sharesDiluted: ['weighted average shares diluted', 'shares diluted', 'weighted avg shares diluted'],

  operatingCashFlow: ['cash from operations', 'cash flow from operations', 'operating cash flow', 'net cash provided by operating activities'],
  capex: [
    'capital expenditures',
    'capital expenditure',
    'capex',
    'purchase of property plant and equipment',
    'purchases of property plant and equipment',
    'additions to property plant and equipment',
  ],
  freeCashFlow: ['free cash flow', 'fcf', 'unlevered free cash flow'],
  freeCashFlowMargin: ['free cash flow margin', 'fcf margin'],
  dividendsPaid: ['dividends paid', 'cash dividends paid'],
  shareBuybacks: ['repurchase of common stock', 'share repurchases', 'stock repurchase', 'buybacks'],
  netIssuanceOfStock: ['issuance of stock', 'proceeds from issuance of stock', 'net issuance of stock'],
  debtIssued: ['issuance of debt', 'proceeds from debt', 'debt issued'],
  debtRepaid: ['repayment of debt', 'debt repaid', 'debt repayment'],

  cashAndEquivalents: ['cash and cash equivalents', 'cash and equivalents', 'cash & cash equivalents', 'cash equivalents'],
  shortTermInvestments: ['short term investments', 'short-term investments'],
  totalCash: ['cash and short term investments', 'cash and short-term investments', 'total cash and short term investments', 'total cash'],
  totalAssets: ['total assets'],
  totalLiabilities: ['total liabilities'],
  totalEquity: [
    'total shareholders equity',
    'total stockholders equity',
    'total common equity',
    'total equity',
    'shareholders equity',
    'stockholders equity',
  ],
  totalDebt: ['total debt', 'short term debt + long term debt', 'short-term debt + long-term debt'],
  netDebt: ['net debt'],
  currentAssets: ['total current assets', 'current assets'],
  currentLiabilities: ['total current liabilities', 'current liabilities'],
  workingCapital: ['working capital'],
  inventory: ['inventory', 'inventories'],
  accountsReceivable: ['accounts receivable', 'trade receivables', 'receivables'],
  accountsPayable: ['accounts payable', 'trade payables', 'payables'],

  roic: ['roic', 'return on invested capital'],
  roe: ['roe', 'return on equity'],
  roa: ['roa', 'return on assets'],

  grossProfitCagr: ['gross profit cagr', 'gross profit 3y cagr', 'gross profit 5y cagr', 'gross profit 10y cagr'],
  revenueCagr: ['revenue cagr', 'revenue 3y cagr', 'revenue 5y cagr', 'revenue 10y cagr', 'revenue cagr 3y', 'revenue cagr 5y', 'revenue cagr 10y'],
  epsCagr: ['eps cagr', 'eps 3y cagr', 'eps 5y cagr', 'eps 10y cagr', 'eps cagr 3y', 'eps cagr 5y', 'eps cagr 10y'],
  fcfCagr: ['fcf cagr', 'fcf 3y cagr', 'fcf 5y cagr', 'fcf 10y cagr', 'free cash flow cagr', 'free cash flow 3y cagr', 'free cash flow 5y cagr', 'free cash flow 10y cagr'],
};

const ALIAS_EXACT_LOOKUP = new Map<string, MetricKey>();
for (const [key, aliases] of Object.entries(METRIC_ALIASES) as [MetricKey, string[]][]) {
  for (const rawAlias of aliases) {
    ALIAS_EXACT_LOOKUP.set(normalizeMetricLabel(rawAlias), key);
  }
}

export function matchMetricKeyFromLabel(rawLabel: string): MetricKey | null {
  const label = normalizeMetricLabel(rawLabel);
  if (!label) return null;

  const exactMatch = ALIAS_EXACT_LOOKUP.get(label);
  if (exactMatch) return exactMatch;

  const contains = (needle: string) => label.includes(needle);

  if (contains('revenue') || contains('net sales')) return 'revenue';
  if (contains('free cash flow') || label === 'fcf') return 'freeCashFlow';
  if (contains('operating cash flow')) return 'operatingCashFlow';
  if (contains('gross profit')) return 'grossProfit';
  if (contains('operating income') || contains('income from operations')) return 'operatingIncome';
  if (contains('ebitda')) return 'ebitda';
  if (contains('ebit')) return 'ebit';
  if (contains('net income') || contains('net earnings')) return 'netIncome';
  if (contains('eps diluted')) return 'epsDiluted';
  if (contains('eps basic')) return 'epsBasic';
  if (contains('capital expenditures') || contains('capex')) return 'capex';
  if (contains('total assets')) return 'totalAssets';
  if (contains('total liabilities')) return 'totalLiabilities';
  if (contains('total equity') || contains('shareholders equity') || contains('stockholders equity')) return 'totalEquity';
  if (contains('total debt')) return 'totalDebt';
  if (contains('net debt')) return 'netDebt';

  // CAGR pattern detection
  if (contains('cagr')) {
    if (contains('revenue')) return 'revenueCagr';
    if (contains('gross profit')) return 'grossProfitCagr';
    if (contains('eps')) return 'epsCagr';
    if (contains('fcf') || contains('free cash flow')) return 'fcfCagr';
  }

  return null;
}
