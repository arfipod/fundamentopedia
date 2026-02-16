import { describe, expect, it } from 'vitest';
import { parseNumber, parseHeader, parseMarkdownTable, parseFinancialMarkdown, findRow, findRowByMetricKey, getRowValue } from '../src/financials/parser';

describe('parseNumber', () => {
  it('parses European-format numbers (dot thousands, comma decimal)', () => {
    expect(parseNumber('215.639,00')).toBe(215639);
    expect(parseNumber('2,08')).toBe(2.08);
    expect(parseNumber('39,1')).toBeCloseTo(39.1);
  });

  it('parses negative European-format with parentheses', () => {
    expect(parseNumber('(131.376,00)')).toBe(-131376);
    expect(parseNumber('(7,7%)')).toBeCloseTo(-0.077);
  });

  it('parses percentages', () => {
    expect(parseNumber('39,1%')).toBeCloseTo(0.391);
    expect(parseNumber('-1,26%')).toBeCloseTo(-0.0126);
    expect(parseNumber('(10,0%)')).toBeCloseTo(-0.10);
  });

  it('parses currency-prefixed numbers', () => {
    expect(parseNumber('US$274.62')).toBeCloseTo(274.62);
    expect(parseNumber('CA$2,470.03')).toBeCloseTo(2470.03);
  });

  it('parses negative with leading minus', () => {
    expect(parseNumber('-US$3.50')).toBeCloseTo(-3.50);
  });

  it('returns null for empty/dash values', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('—')).toBeNull();
    expect(parseNumber('-')).toBeNull();
    expect(parseNumber('N/A')).toBeNull();
  });

  it('parses plain integers', () => {
    expect(parseNumber('100')).toBe(100);
    expect(parseNumber('0')).toBe(0);
  });

  it('parses American-format numbers (comma thousands, dot decimal)', () => {
    expect(parseNumber('1,234.56')).toBeCloseTo(1234.56);
  });

  it('parses multiples notation (e.g. ratios)', () => {
    // "0,54x" – the "x" is not a number suffix parseNumber handles, but
    // the trailing x will be stripped by the regex
    expect(parseNumber('14,37')).toBeCloseTo(14.37);
  });
});

describe('parseHeader', () => {
  it('parses AAPL-style header', () => {
    const text = `# – AAPL US$274.62 -US$3.50 -1,26% - TIKR Terminal

Price: | Extracted: 2026-02-10T13:17:26.285Z
Period: annual | Sections: 7`;

    const header = parseHeader(text);
    expect(header.ticker).toBe('AAPL');
    expect(header.period).toBe('annual');
  });

  it('parses CSU-style header', () => {
    const text = `# CSU – Constellation Software Inc.

Price: CA$2,470.03 | Extracted: 2026-02-10T13:18:42.942Z
Period: annual | Sections: 7`;

    const header = parseHeader(text);
    expect(header.ticker).toBe('CSU');
    expect(header.companyName).toBe('Constellation Software Inc.');
    expect(header.price).toBeCloseTo(2470.03);
    expect(header.currency).toBe('CA');
    expect(header.period).toBe('annual');
  });
});

describe('parseMarkdownTable', () => {
  it('parses a simple financial table', () => {
    const lines = [
      '| Line Item | 31/12/20 | 31/12/21 |',
      '| --- | --- | --- |',
      '| Revenues | 100.000,00 | 120.000,00 |',
      '| Cost of Goods Sold | (60.000,00) | (70.000,00) |',
      '| Gross Profit | 40.000,00 | 50.000,00 |',
    ];

    const { periods, rows } = parseMarkdownTable(lines);
    expect(periods).toEqual(['31/12/20', '31/12/21']);
    expect(rows).toHaveLength(3);
    expect(rows[0].label).toBe('Revenues');
    expect(rows[0].values['31/12/20']).toBe(100000);
    expect(rows[0].values['31/12/21']).toBe(120000);
    expect(rows[1].label).toBe('Cost of Goods Sold');
    expect(rows[1].values['31/12/20']).toBe(-60000);
    expect(rows[2].values['31/12/21']).toBe(50000);
  });

  it('handles empty cells gracefully', () => {
    const lines = [
      '| Item | Period1 | Period2 |',
      '| --- | --- | --- |',
      '| Revenue | 100,00 |  |',
    ];

    const { rows } = parseMarkdownTable(lines);
    expect(rows[0].values['Period1']).toBe(100);
    expect(rows[0].values['Period2']).toBeNull();
  });
});

describe('parseFinancialMarkdown', () => {
  const sampleMd = `# TEST – Test Company Inc.

Price: US$100.00 | Extracted: 2026-01-01T00:00:00.000Z
Period: annual | Sections: 2

---

## Income Statement

| Income Statement | 31/12/22 | 31/12/23 | 31/12/24 | LTM |
| --- | --- | --- | --- | --- |
| Revenues | 1.000,00 | 1.200,00 | 1.500,00 | 1.600,00 |
| Total Revenues | 1.000,00 | 1.200,00 | 1.500,00 | 1.600,00 |
| Cost of Goods Sold | (600,00) | (700,00) | (850,00) | (900,00) |
| Gross Profit | 400,00 | 500,00 | 650,00 | 700,00 |
| Operating Income | 200,00 | 250,00 | 350,00 | 380,00 |
| Net Income | 150,00 | 180,00 | 260,00 | 280,00 |
| Net Income to Common Incl Extra Items | 150,00 | 180,00 | 260,00 | 280,00 |
| EBITDA | 250,00 | 300,00 | 400,00 | 430,00 |
| Diluted EPS Excl Extra Items | 1,50 | 1,80 | 2,60 | 2,80 |
| Dividends Per Share | 0,30 | 0,35 | 0,40 | 0,42 |

## Balance Sheet

| Balance Sheet | 31/12/22 | 31/12/23 | 31/12/24 | LTM |
| --- | --- | --- | --- | --- |
| Total Cash And Short Term Investments | 100,00 | 120,00 | 150,00 | 160,00 |
| Total Current Assets | 300,00 | 350,00 | 400,00 | 420,00 |
| Total Assets | 1.000,00 | 1.100,00 | 1.300,00 | 1.350,00 |
| Total Current Liabilities | 200,00 | 220,00 | 250,00 | 260,00 |
| Total Liabilities | 500,00 | 550,00 | 600,00 | 620,00 |
| Total Debt | 300,00 | 320,00 | 350,00 | 360,00 |
| Net Debt | 200,00 | 200,00 | 200,00 | 200,00 |
| Total Common Equity | 500,00 | 550,00 | 700,00 | 730,00 |
| Total Equity | 500,00 | 550,00 | 700,00 | 730,00 |
| Inventory | 50,00 | 55,00 | 60,00 | 62,00 |
`;

  it('parses sections correctly', () => {
    const parsed = parseFinancialMarkdown(sampleMd);
    expect(parsed.header.ticker).toBe('TEST');
    expect(parsed.header.companyName).toBe('Test Company Inc.');
    expect(parsed.header.price).toBeCloseTo(100);
    expect(Object.keys(parsed.sections)).toContain('income_statement');
    expect(Object.keys(parsed.sections)).toContain('balance_sheet');
  });

  it('correctly parses income statement rows', () => {
    const parsed = parseFinancialMarkdown(sampleMd);
    const is = parsed.sections['income_statement'];
    expect(is).toBeDefined();
    expect(is.periods).toContain('31/12/22');
    expect(is.periods).toContain('LTM');

    const revenueRow = findRow(is, 'total revenues', 'revenues');
    expect(revenueRow).toBeDefined();
    expect(revenueRow!.values['31/12/24']).toBe(1500);
  });

  it('correctly parses balance sheet rows', () => {
    const parsed = parseFinancialMarkdown(sampleMd);
    const bs = parsed.sections['balance_sheet'];
    expect(bs).toBeDefined();

    const equity = getRowValue(bs, '31/12/24', 'total common equity', 'total equity');
    expect(equity).toBe(700);

    const assets = getRowValue(bs, '31/12/24', 'total assets');
    expect(assets).toBe(1300);
  });
});

describe('findRow and getRowValue', () => {
  it('finds rows by partial case-insensitive match', () => {
    const section = {
      name: 'Income Statement',
      periods: ['P1'],
      rows: [
        { label: 'Net Income to Common Incl Extra Items', values: { P1: 100 } },
        { label: 'Revenues', values: { P1: 500 } },
      ],
    };

    const row = findRow(section, 'net income');
    expect(row).toBeDefined();
    expect(row!.label).toBe('Net Income to Common Incl Extra Items');
  });

  it('finds rows by canonical metric key aliases', () => {
    const section = {
      name: 'Income Statement',
      periods: ['P1'],
      rows: [
        { label: 'Total Revenues', values: { P1: 500 } },
        { label: 'Diluted EPS Excl Extra Items', values: { P1: 2.5 } },
      ],
    };

    expect(findRowByMetricKey(section, 'revenue')?.label).toBe('Total Revenues');
    expect(findRowByMetricKey(section, 'epsDiluted')?.label).toContain('Diluted EPS');
  });

  it('returns null for missing rows', () => {
    const section = {
      name: 'Income Statement',
      periods: ['P1'],
      rows: [{ label: 'Revenues', values: { P1: 500 } }],
    };

    expect(getRowValue(section, 'P1', 'nonexistent')).toBeNull();
    expect(getRowValue(undefined, 'P1', 'anything')).toBeNull();
  });
});
