import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProfileRoot } from '../src/types';
import { resolveEffectiveProfile } from '../src/domain/gics/effectiveProfileResolver';

describe('resolveEffectiveProfile', () => {
  const filePath = path.resolve(process.cwd(), 'public/data/gics_watchlist_scorecard_profile_en.json');
  const profile = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ProfileRoot;

  it('resolves a profile with lineage, metrics and ui groups', () => {
    const effective = resolveEffectiveProfile(profile, '45103010');
    expect(effective).toBeTruthy();
    expect(effective?.gics.level).toBe('subIndustry');
    expect(effective?.gics.lineage.length).toBeGreaterThanOrEqual(3);
    expect(effective?.ui?.groups?.length).toBeGreaterThan(0);
  });

  it('includes mapped core metrics with rule and commentary fields', () => {
    const effective = resolveEffectiveProfile(profile, '45103010');
    expect(effective?.metrics.revenue).toBeTruthy();
    expect(effective?.metrics.revenue.priority).toBe('core');
    expect(effective?.metrics.revenue.rules?.length).toBeGreaterThan(0);
    expect(effective?.metrics.revenue.commentary?.title).toBeTruthy();
  });


  it('normalizes percent-based scoring thresholds to decimal values', () => {
    const effective = resolveEffectiveProfile(profile, '45103010');
    const grossMarginRule = effective?.metrics.grossMargin.rules?.[0];
    expect(grossMarginRule?.unit).toBe('percent');
    expect(grossMarginRule?.thresholds?.bull).toBe(0.4);
    expect(grossMarginRule?.thresholds?.neutral).toBe(0.2);
    expect(grossMarginRule?.thresholds?.bear).toBe(0.2);
  });

  it('returns null for unknown gics codes', () => {
    expect(resolveEffectiveProfile(profile, '99999999')).toBeNull();
  });
});
