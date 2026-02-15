/**
 * Application type definitions for the GICS Encyclopedia.
 *
 * These types model the gics_watchlist_scorecard_profile_en.json dataset.
 * See also: /types.ts (root) for the full reference schema with additional
 * types used by data-generation tooling.
 */

export type GicsLevel = 'sector' | 'industry_group' | 'industry' | 'sub_industry';
export type MetricCategory = 'core' | 'secondary' | 'risk';

/** Matches `metric_library[metric_id].statement` */
export type FinancialStatement = 'income' | 'balance' | 'cashflow' | 'derived' | 'operational' | 'var';

export interface MetricLibraryEntry {
  /** Display label (EN in canonical file; key kept as `label_es` for legacy compat). */
  label_es: string;
  statement: FinancialStatement;
  /** Optional formula / explanation string. */
  formula?: string;
  /** Why this metric matters. */
  why: string;
  /** Common pitfalls / what to watch for. */
  watch_for?: string;
}

export interface MetricPriority {
  priority: number; // 1..N
  category: MetricCategory;
}

/** metric_id -> priority/category */
export type MetricPriorityMap = Record<string, MetricPriority>;
/** bucket_id -> weight (0..1) */
export type BucketWeightMap = Record<string, number>;
/** metric_id -> weight (0..1) */
export type MetricWeightMap = Record<string, number>;

export interface ThresholdRuleBase {
  type: 'higher_better' | 'lower_better' | 'target_range' | 'informational';
  unit: string; // e.g. "percent", "turns", "ratio"
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
/** metric_id -> scoring rule */
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
  /** template_id -> bucket weights */
  bucket_weights_by_template: Record<string, BucketWeightMap>;
  /** metric_id -> bucket_id */
  metric_bucket_map: Record<string, string>;
  /** template_id -> (metric_id -> override rule) */
  threshold_overrides_by_template: Record<string, ThresholdOverrideMap>;
  aggregation: {
    bucket_score_method: string;
    overall_score_method: string;
    missing_metric_policy: string;
  };
}

/** Templates define recommended metric sets by model/industry. */
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
  /** Metrics excluded from scoring, shown as informational only. */
  informational_metrics: string[];
  bucket_weights: BucketWeightMap;
  bucket_metric_weights: Record<string, unknown>;
  /** Present only for some sub-industries. */
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
  /** In gics_tree the priorities are stored under kpi_priorities. */
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
