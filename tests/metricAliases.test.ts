import { describe, expect, it } from 'vitest';
import { matchMetricKeyFromLabel, normalizeMetricLabel } from '../src/domain/financials/metricAliases';

describe('metricAliases', () => {
  it('normalizes punctuation and spacing', () => {
    expect(normalizeMetricLabel('  Depreciation & Amortization ')).toBe('depreciation and amortization');
    expect(normalizeMetricLabel('Net Income — (Loss)')).toBe('net income - loss');
  });

  it('matches exact aliases', () => {
    expect(matchMetricKeyFromLabel('Total Revenues')).toBe('revenue');
    expect(matchMetricKeyFromLabel('Cash Flow from Operations')).toBe('operatingCashFlow');
    expect(matchMetricKeyFromLabel('Total Common Equity')).toBe('totalEquity');
  });

  it('matches heuristic labels', () => {
    expect(matchMetricKeyFromLabel('Revenue (USD)')).toBe('revenue');
    expect(matchMetricKeyFromLabel('Net Income (Loss)')).toBe('netIncome');
    expect(matchMetricKeyFromLabel('CAPEX adjusted')).toBe('capex');
  });

  it('returns null when no mapping exists', () => {
    expect(matchMetricKeyFromLabel('Customer churn')).toBeNull();
  });
});
