/**
 * Full reference types for gics_watchlist_scorecard_profile_en.json
 * (canonical EN dataset; display strings may still be under *_es keys).
 *
 * NOTE: The application imports types from src/types.ts, which is the
 * authoritative set for the running app. This file contains additional
 * types used by data-generation tooling and as a reference schema.
 *
 * Tip: when fetching JSON, treat it as unknown and (optionally) validate,
 * then cast to ProfileRoot.
 */

export type GicsLevel = "sector" | "industry_group" | "industry" | "sub_industry";
export type MetricCategory = "core" | "secondary" | "risk";

/** Matches `metric_library[metric_id].statement` */
export type FinancialStatement =
  | "income"
  | "balance"
  | "cashflow"
  | "derived"
  | "operational"
  | "var";

export interface MetricLibraryEntry {
  /** Display label (in the canonical file this is EN text, but key name is `label_es`). */
  label_es: string;
  statement: FinancialStatement;
  /** Optional formula/explanation string. */
  formula?: string;
  /** Why this metric matters. */
  why: string;
  /** Common pitfalls / what to watch for. */
  watch_for?: string;
}

export interface MetricPriority {
  priority: number; // 1..5
  category: MetricCategory;
}

/** Map metric_id -> priority/category */
export type MetricPriorityMap = Record<string, MetricPriority>;

/** Map bucket_id -> weight (0..1) */
export type BucketWeightMap = Record<string, number>;

/** Map metric_id -> weight (0..1) */
export type MetricWeightMap = Record<string, number>;

export interface BucketMetricRow {
  metric_id: string;
  weight: number; // final weight within node (after priority+normalization)
  priority: number;
  category: MetricCategory;
  /** normalized within bucket (0..1) */
  weight_in_bucket: number;
}

export interface BucketMetricWeights {
  bucket_weight: number; // (0..1) weight of the bucket in the node scorecard
  metrics: BucketMetricRow[];
}

/** bucket_id -> weights + metric rows */
export type BucketMetricWeightsMap = Record<string, BucketMetricWeights>;

export interface ThresholdRuleBase {
  type: "higher_better" | "lower_better" | "target_range" | "informational";
  unit: string; // e.g. "percent", "turns", "cents_per_asm", "var"
  note?: string;
}

export interface HigherBetterRule extends ThresholdRuleBase {
  type: "higher_better";
  bull_min?: number | null;
  neutral_min?: number | null;
  neutral_max?: number | null;
  bear_max?: number | null;
}

export interface LowerBetterRule extends ThresholdRuleBase {
  type: "lower_better";
  bull_max?: number | null;
  neutral_min?: number | null;
  neutral_max?: number | null;
  bear_min?: number | null;
}

export interface TargetRangeRule extends ThresholdRuleBase {
  type: "target_range";
  bull_min: number;
  bull_max: number;
  neutral_min: number;
  neutral_max: number;
}

export interface InformationalRule extends ThresholdRuleBase {
  type: "informational";
}

export type ScoringRule =
  | HigherBetterRule
  | LowerBetterRule
  | TargetRangeRule
  | InformationalRule;

/** metric_id -> scoring rule */
export type ScoringRuleMap = Record<string, ScoringRule>;

/**
 * Threshold overrides share the same structure as scoring rules,
 * but are typically attached to:
 * - scorecard_config.threshold_overrides_by_template[templateId][metricId]
 * - gics_profile_index[nodeCode].threshold_overrides[metricId]
 */
export type ThresholdOverride = ScoringRule;
export type ThresholdOverrideMap = Record<string, ThresholdOverride>;

export interface ScorecardBucket {
  id: string; // bucket_id
  label_es: string; // display label (EN in canonical file)
  description_es: string; // display description (EN in canonical file)
}

export interface ScorecardAggregationConfig {
  bucket_score_method: "weighted_average";
  overall_score_method: "weighted_average_of_buckets";
  missing_metric_policy: "renormalize_within_bucket_then_overall";
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
  aggregation: ScorecardAggregationConfig;
}

/** Templates define recommended metric sets by model/industry. */
export interface TemplateEntry {
  core: string[];
  secondary: string[];
  risk: string[];
  notes: string;
}

export type TemplateMap = Record<string, TemplateEntry>;

/**
 * Profile nodes (authoritative for the encyclopedia “what to watch”):
 * gics_profile_index[code]
 */
export interface GicsProfileIndexNode {
  level: GicsLevel;
  name_es: string; // display name (EN in canonical file)
  path_es: string[]; // breadcrumb display names (EN in canonical file)
  applies_templates: string[];

  metric_priorities: MetricPriorityMap;
  metric_weights: MetricWeightMap;
  metric_weights_bucketed: MetricWeightMap;

  /** metrics excluded from scoring, shown as informational only */
  informational_metrics: string[];

  bucket_weights: BucketWeightMap;
  bucket_metric_weights: BucketMetricWeightsMap;

  /** present only for some sub-industries */
  threshold_overrides?: ThresholdOverrideMap;
}

/** code -> profile */
export type GicsProfileIndex = Record<string, GicsProfileIndexNode>;

/**
 * gics_tree is used for navigation. It also contains “watchlist/scoring” info,
 * but for the UI you typically only need code/name/children.
 */
export interface TreeOverrides {
  add_core: string[];
  add_secondary: string[];
  add_risk: string[];
  remove: string[];
}

export interface TreeWatchlist {
  core: string[];
  secondary: string[];
  risk: string[];
}

export interface TreeScoringInfo {
  weight_by_priority: Record<string, number>; // keys: "1".."5"
  normalization: {
    method: string;
    excluded_rule_types: string[];
  };
  metric_weights: MetricWeightMap;
  informational_metrics: string[];
  notes: string;
}

export interface GicsTreeNode {
  level: GicsLevel;
  code: string;
  name_es: string;
  applies_templates?: string[];
  overrides?: TreeOverrides;
  watchlist?: TreeWatchlist;

  /** NOTE: in gics_tree the priorities are stored under kpi_priorities */
  kpi_priorities?: MetricPriorityMap;
  scoring?: TreeScoringInfo;

  children?: GicsTreeNode[];
}

export interface StatementMetricIndex {
  income: string[];
  balance: string[];
  cashflow: string[];
  derived: string[];
  operational: string[];
}

export interface ProfileRoot {
  schema_version: string;
  generated_at_utc: string;
  language: string; // "en"
  source_note?: string;
  notes?: string[];

  metric_library: Record<string, MetricLibraryEntry>;
  statement_metric_index: StatementMetricIndex;

  templates: TemplateMap;
  gics_tree: GicsTreeNode[];

  scoring_rules: ScoringRuleMap;
  weight_by_priority_default: Record<string, number>;

  gics_profile_index: GicsProfileIndex;
  scorecard_config: ScorecardConfig;
}
