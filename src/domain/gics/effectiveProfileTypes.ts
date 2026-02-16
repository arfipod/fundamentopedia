import type { MetricKey } from '../financials/metricAliases';

export type Signal = 'bull' | 'neutral' | 'bear' | 'na';

export type GrowthRule = {
  kind: 'cagr' | 'yoy' | 'margin' | 'level';
  thresholds?: {
    bull?: number;
    neutral?: number;
    bear?: number;
  };
  direction?: 'higherIsBetter' | 'lowerIsBetter';
  unit?: string;
  notes?: string;
};

export type MetricCommentary = {
  title: string;
  definition?: string;
  whatToWatch?: string;
  ranges?: string;
  pitfalls?: string;
  keyQuestion?: string;
  unitsHint?: string;
};

export type EffectiveMetricProfile = {
  key: MetricKey;
  priority?: 'core' | 'secondary' | 'risk';
  weight?: number;
  commentary?: MetricCommentary;
  rules?: GrowthRule[];
  supports?: {
    cagr?: boolean;
    windows?: number[];
  };
};

export type EffectiveProfile = {
  gics: {
    level: 'sector' | 'industryGroup' | 'industry' | 'subIndustry';
    code: string;
    name: string;
    lineage: { level: string; code: string; name: string }[];
  };
  metrics: Record<MetricKey, EffectiveMetricProfile>;
  ui?: {
    groups?: { id: string; title: string; metricKeys: MetricKey[] }[];
  };
  provenance?: {
    mergedFrom: { level: string; code: string; name: string }[];
    overrides: Record<string, string[]>;
  };
};
