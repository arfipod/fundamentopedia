import { describe, expect, it } from 'vitest';
import { parseFinancialMarkdown } from '../src/financials/parser';
import { analyzeFinancials } from '../src/financials/calculator';

const sampleMd = `# TEST – Test Company Inc.

Price: US$100.00 | Extracted: 2026-01-01T00:00:00.000Z
Period: annual | Sections: 2

---

## Income Statement

| Income Statement | 31/12/21 | 31/12/22 | 31/12/23 | 31/12/24 | LTM |
| --- | --- | --- | --- | --- | --- |
| Revenues | 800,00 | 1.000,00 | 1.200,00 | 1.500,00 | 1.600,00 |
| Total Revenues | 800,00 | 1.000,00 | 1.200,00 | 1.500,00 | 1.600,00 |
| Cost of Goods Sold | (480,00) | (600,00) | (700,00) | (850,00) | (900,00) |
| Gross Profit | 320,00 | 400,00 | 500,00 | 650,00 | 700,00 |
| Operating Income | 160,00 | 200,00 | 250,00 | 350,00 | 380,00 |
| Net Income | 120,00 | 150,00 | 180,00 | 260,00 | 280,00 |
| Net Income to Common Incl Extra Items | 120,00 | 150,00 | 180,00 | 260,00 | 280,00 |
| EBITDA | 200,00 | 250,00 | 300,00 | 400,00 | 430,00 |
| Diluted EPS Excl Extra Items | 1,20 | 1,50 | 1,80 | 2,60 | 2,80 |
| Interest Expense | (10,00) | (12,00) | (15,00) | (18,00) | (20,00) |
| Effective Tax Rate % | 25,0% | 25,0% | 25,0% | 25,0% | 25,0% |

## Balance Sheet

| Balance Sheet | 31/12/21 | 31/12/22 | 31/12/23 | 31/12/24 | LTM |
| --- | --- | --- | --- | --- | --- |
| Total Cash And Short Term Investments | 80,00 | 100,00 | 120,00 | 150,00 | 160,00 |
| Inventory | 40,00 | 50,00 | 55,00 | 60,00 | 62,00 |
| Total Current Assets | 250,00 | 300,00 | 350,00 | 400,00 | 420,00 |
| Total Assets | 800,00 | 1.000,00 | 1.100,00 | 1.300,00 | 1.350,00 |
| Total Current Liabilities | 150,00 | 200,00 | 220,00 | 250,00 | 260,00 |
| Total Liabilities | 400,00 | 500,00 | 550,00 | 600,00 | 620,00 |
| Total Debt | 250,00 | 300,00 | 320,00 | 350,00 | 360,00 |
| Net Debt | 170,00 | 200,00 | 200,00 | 200,00 | 200,00 |
| Total Common Equity | 400,00 | 500,00 | 550,00 | 700,00 | 730,00 |
| Total Equity | 400,00 | 500,00 | 550,00 | 700,00 | 730,00 |

## Cash Flow

| Cash Flow Statement | 31/12/21 | 31/12/22 | 31/12/23 | 31/12/24 |
| --- | --- | --- | --- | --- |
| Cash from Operations | 180,00 | 220,00 | 260,00 | 340,00 |
| Capital Expenditure | (30,00) | (35,00) | (40,00) | (50,00) |
| Free Cash Flow | 150,00 | 185,00 | 220,00 | 290,00 |
`;

describe('analyzeFinancials', () => {
  const parsed = parseFinancialMarkdown(sampleMd);
  const report = analyzeFinancials(parsed);

  it('produces a report with header', () => {
    expect(report.header.ticker).toBe('TEST');
    expect(report.header.companyName).toBe('Test Company Inc.');
  });

  it('contains analysis groups', () => {
    expect(report.analysis.length).toBeGreaterThan(0);
    const titles = report.analysis.map((g) => g.title);
    expect(titles).toContain('Profitability Analysis');
    expect(titles).toContain('Growth Analysis');
    expect(titles).toContain('Return Analysis');
    expect(titles).toContain('Balance Sheet & Solvency');
    expect(titles).toContain('Cash Flow Analysis');
  });

  it('computes gross margin correctly', () => {
    const profitGroup = report.analysis.find((g) => g.title === 'Profitability Analysis');
    const grossMargin = profitGroup?.metrics.find((m) => m.label === 'Gross Margin');
    expect(grossMargin).toBeDefined();
    // 650/1500 = 0.4333
    expect(grossMargin!.values['31/12/24']).toBeCloseTo(0.4333, 3);
  });

  it('computes operating margin correctly', () => {
    const profitGroup = report.analysis.find((g) => g.title === 'Profitability Analysis');
    const opMargin = profitGroup?.metrics.find((m) => m.label === 'Operating Margin');
    expect(opMargin).toBeDefined();
    // 350/1500 = 0.2333
    expect(opMargin!.values['31/12/24']).toBeCloseTo(0.2333, 3);
  });

  it('computes net margin correctly', () => {
    const profitGroup = report.analysis.find((g) => g.title === 'Profitability Analysis');
    const netMargin = profitGroup?.metrics.find((m) => m.label === 'Net Margin');
    expect(netMargin).toBeDefined();
    // 260/1500 = 0.1733
    expect(netMargin!.values['31/12/24']).toBeCloseTo(0.1733, 3);
  });

  it('computes revenue YoY growth correctly', () => {
    const profitGroup = report.analysis.find((g) => g.title === 'Profitability Analysis');
    const revGrowth = profitGroup?.metrics.find((m) => m.label === 'Revenue YoY Growth');
    expect(revGrowth).toBeDefined();
    // 1500/1200 - 1 = 0.25
    expect(revGrowth!.values['31/12/24']).toBeCloseTo(0.25, 3);
  });

  it('computes ROE correctly', () => {
    const returnGroup = report.analysis.find((g) => g.title === 'Return Analysis');
    const roe = returnGroup?.metrics.find((m) => m.label === 'Return on Equity (ROE)');
    expect(roe).toBeDefined();
    // 260/700 = 0.3714
    expect(roe!.values['31/12/24']).toBeCloseTo(0.3714, 3);
  });

  it('computes current ratio correctly', () => {
    const solvGroup = report.analysis.find((g) => g.title === 'Balance Sheet & Solvency');
    const cr = solvGroup?.metrics.find((m) => m.label === 'Current Ratio');
    expect(cr).toBeDefined();
    // 400/250 = 1.6
    expect(cr!.values['31/12/24']).toBeCloseTo(1.6, 2);
  });

  it('computes FCF margin correctly', () => {
    const cfGroup = report.analysis.find((g) => g.title === 'Cash Flow Analysis');
    const fcfMargin = cfGroup?.metrics.find((m) => m.label === 'FCF Margin');
    expect(fcfMargin).toBeDefined();
    // 290/1500 = 0.1933
    expect(fcfMargin!.values['31/12/24']).toBeCloseTo(0.1933, 3);
  });

  it('computes interest coverage correctly', () => {
    const solvGroup = report.analysis.find((g) => g.title === 'Balance Sheet & Solvency');
    const intCov = solvGroup?.metrics.find((m) => m.label === 'Interest Coverage');
    expect(intCov).toBeDefined();
    // 350/18 = 19.44
    expect(intCov!.values['31/12/24']).toBeCloseTo(19.44, 1);
  });

  it('produces a summary', () => {
    const s = report.summary;
    expect(s.latestPeriod).toBe('31/12/24');
    expect(s.revenueLatest).toBe(1500);
    expect(s.netIncomeLatest).toBe(260);
    expect(s.grossMarginLatest).toBeCloseTo(0.4333, 3);
    expect(s.roe).toBeCloseTo(0.3714, 3);
    expect(s.currentRatio).toBeCloseTo(1.6, 2);
    expect(s.debtToEquity).toBeCloseTo(0.5, 2);
    expect(s.fcfMargin).toBeCloseTo(0.1933, 3);
  });

  it('computes revenue CAGR 3Y', () => {
    const s = report.summary;
    // From 31/12/21 (800) to 31/12/24 (1500): (1500/800)^(1/3) - 1 ≈ 0.2334
    expect(s.revenueCAGR3Y).toBeCloseTo(0.2334, 3);
  });
});


const valuationMd = `# VAL – Value Co

Price: US$50.00 | Extracted: 2026-01-01T00:00:00.000Z
Period: annual | Sections: 1

---

## Income Statement

| Income Statement | 31/12/23 | 31/12/24 |
| --- | --- | --- |
| Revenues | 1.000,00 | 1.100,00 |

## Valuation Multiples

| Valuation Multiples | 31/12/24 | 31/03/25 |
| --- | --- | --- |
| NTM Price / Normalized Earnings | 20,00 | 18,00 |
| NTM Total Enterprise Value / Revenues | 6,00 | 5,50 |
| NTM Levered Free Cash Flow Yield | 3,00% | 4,00% |
| LTM Dividend Yield | 1,20% | 1,10% |
`;

describe('valuation metric units', () => {
  it('marks yield metrics as percent and keeps multiples as ratio', () => {
    const parsed = parseFinancialMarkdown(valuationMd);
    const report = analyzeFinancials(parsed);
    const valGroup = report.analysis.find((g) => g.title === 'Valuation Multiples');

    const ntmEvRevenue = valGroup?.metrics.find((m) => m.label === 'NTM EV/Revenue');
    const ntmFcfYield = valGroup?.metrics.find((m) => m.label === 'NTM FCF Yield');
    const ltmDividendYield = valGroup?.metrics.find((m) => m.label === 'LTM Dividend Yield');

    expect(ntmEvRevenue?.unit).toBe('ratio');
    expect(ntmFcfYield?.unit).toBe('percent');
    expect(ltmDividendYield?.unit).toBe('percent');

    expect(ntmFcfYield?.values['31/12/24']).toBeCloseTo(0.03, 5);
    expect(ltmDividendYield?.values['31/12/24']).toBeCloseTo(0.012, 5);
  });
});
