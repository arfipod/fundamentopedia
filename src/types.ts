export type GicsLevel = 'sector' | 'industry_group' | 'industry' | 'sub_industry';
export type MetricCategory = 'core' | 'secondary' | 'risk';

export interface MetricLibraryEntry {
  label_es: string;
  statement: string;
  formula?: string;
  why: string;
  watch_for?: string;
}

export interface MetricPriority {
  priority: number;
  category: MetricCategory;
}

export type MetricPriorityMap = Record<string, MetricPriority>;
export type BucketWeightMap = Record<string, number>;
export type MetricWeightMap = Record<string, number>;

export interface ThresholdRuleBase {
  type: 'higher_better' | 'lower_better' | 'target_range' | 'informational';
  unit: string;
  note?: string;
}

export interface HigherBetterRule extends ThresholdRuleBase {
  type: 'higher_better';
  bull_min?: number | null;
  neutral_min?: number | null;
  neutral_max?: number | null;
  bear_max?: number | null;
}

export interface LowerBetterRule extends ThresholdRuleBase {
  type: 'lower_better';
  bull_max?: number | null;
  neutral_min?: number | null;
  neutral_max?: number | null;
  bear_min?: number | null;
}

export interface TargetRangeRule extends ThresholdRuleBase {
  type: 'target_range';
  bull_min: number;
  bull_max: number;
  neutral_min: number;
  neutral_max: number;
}

export interface InformationalRule extends ThresholdRuleBase {
  type: 'informational';
}

export type ScoringRule = HigherBetterRule | LowerBetterRule | TargetRangeRule | InformationalRule;
export type ScoringRuleMap = Record<string, ScoringRule>;
export type ThresholdOverride = ScoringRule;
export type ThresholdOverrideMap = Record<string, ThresholdOverride>;

export interface ScorecardBucket {
  id: string;
  label_es: string;
  description_es: string;
}

export interface ScorecardConfig {
  buckets: ScorecardBucket[];
  bucket_weights_default: BucketWeightMap;
  bucket_weights_by_template: Record<string, BucketWeightMap>;
  metric_bucket_map: Record<string, string>;
  threshold_overrides_by_template: Record<string, ThresholdOverrideMap>;
  aggregation: {
    bucket_score_method: string;
    overall_score_method: string;
    missing_metric_policy: string;
  };
}

export interface TemplateEntry {
  core: string[];
  secondary: string[];
  risk: string[];
  notes: string;
}

export interface GicsProfileIndexNode {
  level: GicsLevel;
  name_es: string;
  path_es: string[];
  applies_templates: string[];
  metric_priorities: MetricPriorityMap;
  metric_weights: MetricWeightMap;
  metric_weights_bucketed: MetricWeightMap;
  informational_metrics: string[];
  bucket_weights: BucketWeightMap;
  bucket_metric_weights: Record<string, unknown>;
  threshold_overrides?: ThresholdOverrideMap;
}

export interface TreeWatchlist {
  core: string[];
  secondary: string[];
  risk: string[];
}

export interface TreeOverrides {
  add_core?: string[];
  add_secondary?: string[];
  add_risk?: string[];
  remove?: string[];
}

export interface TreeScoring {
  informational_metrics?: string[];
  threshold_overrides?: ThresholdOverrideMap;
}

export interface GicsTreeNode {
  level: GicsLevel;
  code: string;
  name_es: string;
  applies_templates?: string[];
  overrides?: TreeOverrides;
  watchlist?: TreeWatchlist;
  kpi_priorities?: MetricPriorityMap;
  scoring?: TreeScoring;
  children?: GicsTreeNode[];
}

export interface ResolvedGicsProfile {
  code: string;
  level: GicsLevel;
  name_es: string;
  path: string[];
  templates: string[];
  watchlist: TreeWatchlist;
  kpi_priorities: MetricPriorityMap;
  metric_weights: MetricWeightMap;
  informational_metrics: string[];
  bucketed_weights: MetricWeightMap;
  bucket_weights: BucketWeightMap;
  threshold_overrides?: ThresholdOverrideMap;
}

export interface ProfileRoot {
  schema_version: string;
  generated_at_utc: string;
  language: string;
  metric_library: Record<string, MetricLibraryEntry>;
  templates: Record<string, TemplateEntry>;
  gics_tree: GicsTreeNode[];
  scoring_rules: ScoringRuleMap;
  weight_by_priority_default?: Record<string, number>;
  gics_profile_index: Record<string, GicsProfileIndexNode>;
  scorecard_config: ScorecardConfig;
}

export type LocaleMap = Record<string, string>;
