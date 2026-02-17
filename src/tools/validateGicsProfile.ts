/**
 * validateGicsProfile.ts
 *
 * Deterministic validation tool + optional auto-fix pass for the GICS
 * watchlist scorecard profile JSON.
 *
 * Usage:
 *   npx tsx src/tools/validateGicsProfile.ts          # validate only
 *   npx tsx src/tools/validateGicsProfile.ts --fix     # validate + apply safe fixes
 *
 * Outputs:
 *   - Console summary (errors + warnings)
 *   - reports/gics_profile_validation.md
 *   - (with --fix) reports/gics_profile_validation_fixed.md
 *   - Exit code 1 if any ERROR, 0 otherwise
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");
const JSON_PATH = resolve(ROOT, "public/data/gics_watchlist_scorecard_profile_en.json");
const REPORTS_DIR = resolve(ROOT, "reports");

// ---------------------------------------------------------------------------
// Types (self-contained – mirrors types.ts but only what we need)
// ---------------------------------------------------------------------------

interface MetricLibraryEntry {
  label_es?: string;
  label?: string;
  label_en?: string;
  description_es?: string;
  description?: string;
  description_en?: string;
  statement?: string;
  formula?: string;
  why?: string;
  watch_for?: string;
  [key: string]: unknown;
}

interface TemplateEntry {
  core: string[];
  secondary: string[];
  risk: string[];
  notes?: string;
}

interface TreeWatchlist {
  core: string[];
  secondary: string[];
  risk: string[];
}

interface TreeScoringInfo {
  metric_weights?: Record<string, number>;
  informational_metrics?: string[];
  [key: string]: unknown;
}

interface GicsTreeNode {
  level: string;
  code: string;
  name_es?: string;
  name?: string;
  applies_templates?: string[];
  overrides?: Record<string, unknown>;
  watchlist?: TreeWatchlist;
  kpi_priorities?: Record<string, unknown>;
  scoring?: TreeScoringInfo;
  children?: GicsTreeNode[];
}

interface ScoringRule {
  type: string;
  unit?: string;
  bull_min?: number | null;
  bull_max?: number | null;
  neutral_min?: number | null;
  neutral_max?: number | null;
  bear_min?: number | null;
  bear_max?: number | null;
  note?: string;
}

interface GicsProfileIndexNode {
  metric_weights?: Record<string, number>;
  bucket_weights?: Record<string, number>;
  informational_metrics?: string[];
  [key: string]: unknown;
}

interface ProfileRoot {
  schema_version?: string;
  metric_library: Record<string, MetricLibraryEntry>;
  templates: Record<string, TemplateEntry>;
  gics_tree: GicsTreeNode[];
  scoring_rules: Record<string, ScoringRule>;
  gics_profile_index?: Record<string, GicsProfileIndexNode>;
  scorecard_config?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

type Severity = "ERROR" | "WARNING";

interface Diagnostic {
  severity: Severity;
  rule: string;
  location: string;
  message: string;
}

interface FixAction {
  location: string;
  description: string;
}

const diagnostics: Diagnostic[] = [];
const fixes: FixAction[] = [];

function report(severity: Severity, rule: string, location: string, message: string): void {
  diagnostics.push({ severity, rule, location, message });
}

// ---------------------------------------------------------------------------
// Allowed enums (inferred from existing data)
// ---------------------------------------------------------------------------

const ALLOWED_STATEMENTS = new Set([
  "income", "balance", "cashflow", "derived", "operational", "var",
]);

const ALLOWED_RULE_TYPES = new Set([
  "higher_better", "lower_better", "target_range", "informational",
]);

const ALLOWED_UNITS = new Set([
  "percent", "x", "var", "cents_per_asm", "cost_per_unit",
  "currency_or_per_share", "percent_of_net_income",
]);

// ---------------------------------------------------------------------------
// 1) Watchlist reference validation (tree nodes)
// ---------------------------------------------------------------------------

function validateWatchlistRefs(
  data: ProfileRoot,
  doFix: boolean,
): void {
  const ml = data.metric_library;

  function walkTree(nodes: GicsTreeNode[], pathPrefix: string): void {
    for (const node of nodes) {
      const loc = `${pathPrefix}/${node.code} (${node.name_es ?? node.name ?? "?"})`;
      const wl = node.watchlist;
      if (!wl) continue;

      const categories: (keyof TreeWatchlist)[] = ["core", "secondary", "risk"];

      // Check each category for missing refs, duplicates, empty strings
      for (const cat of categories) {
        const list = wl[cat] ?? [];
        // Empty strings / nulls
        for (const id of list) {
          if (!id || typeof id !== "string" || id.trim() === "") {
            report("ERROR", "watchlist_empty_ref", `${loc} > watchlist.${cat}`,
              `Empty or null metric id found.`);
          }
        }
        // Missing from metric_library
        for (const id of list) {
          if (id && !(id in ml)) {
            report("ERROR", "watchlist_missing_metric", `${loc} > watchlist.${cat}`,
              `Metric "${id}" not found in metric_library.`);
          }
        }
        // Duplicates within category
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const id of list) {
          if (seen.has(id)) dupes.push(id);
          seen.add(id);
        }
        if (dupes.length > 0) {
          report("WARNING", "watchlist_duplicate", `${loc} > watchlist.${cat}`,
            `Duplicate metric(s): ${[...new Set(dupes)].join(", ")}`);
          if (doFix) {
            wl[cat] = dedupe(list);
            fixes.push({
              location: `${loc} > watchlist.${cat}`,
              description: `Deduplicated: removed ${dupes.length} duplicate(s).`,
            });
          }
        }
      }

      // Cross-category overlaps (tree nodes: core > secondary > risk)
      const coreSet = new Set(wl.core ?? []);
      const secSet = new Set(wl.secondary ?? []);
      const riskSet = new Set(wl.risk ?? []);

      const coreSec = intersection(coreSet, secSet);
      const coreRisk = intersection(coreSet, riskSet);
      const secRisk = intersection(secSet, riskSet);

      if (coreSec.size > 0) {
        report("WARNING", "watchlist_overlap", `${loc} > watchlist`,
          `core/secondary overlap: ${[...coreSec].join(", ")}`);
        if (doFix) {
          wl.secondary = wl.secondary.filter(m => !coreSec.has(m));
          fixes.push({
            location: `${loc} > watchlist.secondary`,
            description: `Removed overlap with core: ${[...coreSec].join(", ")}`,
          });
        }
      }
      if (coreRisk.size > 0) {
        report("WARNING", "watchlist_overlap", `${loc} > watchlist`,
          `core/risk overlap: ${[...coreRisk].join(", ")}`);
        if (doFix) {
          wl.risk = wl.risk.filter(m => !coreRisk.has(m));
          fixes.push({
            location: `${loc} > watchlist.risk`,
            description: `Removed overlap with core: ${[...coreRisk].join(", ")}`,
          });
        }
      }
      if (secRisk.size > 0) {
        report("WARNING", "watchlist_overlap", `${loc} > watchlist`,
          `secondary/risk overlap: ${[...secRisk].join(", ")}`);
        if (doFix) {
          // Tree nodes: secondary > risk
          wl.risk = wl.risk.filter(m => !secRisk.has(m));
          fixes.push({
            location: `${loc} > watchlist.risk`,
            description: `Removed overlap with secondary: ${[...secRisk].join(", ")}`,
          });
        }
      }

      if (node.children) walkTree(node.children, loc);
    }
  }

  walkTree(data.gics_tree, "gics_tree");
}

// ---------------------------------------------------------------------------
// 2) Rule coverage
// ---------------------------------------------------------------------------

function validateRuleCoverage(data: ProfileRoot): void {
  const sr = data.scoring_rules;
  const allRefs = collectAllMetricRefs(data);

  for (const metricId of allRefs) {
    if (!(metricId in sr)) {
      report("WARNING", "rule_coverage_missing", `scoring_rules`,
        `Metric "${metricId}" is referenced in watchlists/templates but has no scoring_rule entry.`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3) Scoring rules sanity
// ---------------------------------------------------------------------------

function validateScoringRules(data: ProfileRoot): void {
  for (const [id, rule] of Object.entries(data.scoring_rules)) {
    const loc = `scoring_rules.${id}`;

    // Type check
    if (!ALLOWED_RULE_TYPES.has(rule.type)) {
      report("WARNING", "scoring_rule_type", loc,
        `Unknown rule type "${rule.type}".`);
    }

    // Unit check
    if (rule.unit && !ALLOWED_UNITS.has(rule.unit)) {
      report("WARNING", "scoring_rule_unit", loc,
        `Unknown unit "${rule.unit}".`);
    }

    // Threshold consistency
    if (rule.type === "higher_better") {
      validateHigherBetter(id, rule);
    } else if (rule.type === "lower_better") {
      validateLowerBetter(id, rule);
    } else if (rule.type === "target_range") {
      validateTargetRange(id, rule);
    }
  }
}

function validateHigherBetter(id: string, rule: ScoringRule): void {
  const loc = `scoring_rules.${id}`;
  const bull = rule.bull_min;
  const nMin = rule.neutral_min;
  const nMax = rule.neutral_max;
  const bear = rule.bear_max;

  // Expected ordering: bear_max <= neutral_min <= neutral_max <= bull_min
  if (isNum(bear) && isNum(nMin) && bear! > nMin!) {
    report("ERROR", "threshold_order", loc,
      `higher_better: bear_max (${bear}) > neutral_min (${nMin}).`);
  }
  if (isNum(nMin) && isNum(nMax) && nMin! > nMax!) {
    report("ERROR", "threshold_order", loc,
      `higher_better: neutral_min (${nMin}) > neutral_max (${nMax}).`);
  }
  if (isNum(nMax) && isNum(bull) && nMax! > bull!) {
    report("ERROR", "threshold_order", loc,
      `higher_better: neutral_max (${nMax}) > bull_min (${bull}).`);
  }
}

function validateLowerBetter(id: string, rule: ScoringRule): void {
  const loc = `scoring_rules.${id}`;
  const bull = rule.bull_max;
  const nMin = rule.neutral_min;
  const nMax = rule.neutral_max;
  const bear = rule.bear_min;

  // Expected ordering: bull_max <= neutral_min <= neutral_max <= bear_min
  if (isNum(bull) && isNum(nMin) && bull! > nMin!) {
    report("ERROR", "threshold_order", loc,
      `lower_better: bull_max (${bull}) > neutral_min (${nMin}).`);
  }
  if (isNum(nMin) && isNum(nMax) && nMin! > nMax!) {
    report("ERROR", "threshold_order", loc,
      `lower_better: neutral_min (${nMin}) > neutral_max (${nMax}).`);
  }
  if (isNum(nMax) && isNum(bear) && nMax! > bear!) {
    report("ERROR", "threshold_order", loc,
      `lower_better: neutral_max (${nMax}) > bear_min (${bear}).`);
  }
}

function validateTargetRange(id: string, rule: ScoringRule): void {
  const loc = `scoring_rules.${id}`;

  // neutral range should contain bull range
  if (isNum(rule.neutral_min) && isNum(rule.bull_min) && rule.neutral_min! > rule.bull_min!) {
    report("ERROR", "threshold_order", loc,
      `target_range: neutral_min (${rule.neutral_min}) > bull_min (${rule.bull_min}).`);
  }
  if (isNum(rule.neutral_max) && isNum(rule.bull_max) && rule.neutral_max! < rule.bull_max!) {
    report("ERROR", "threshold_order", loc,
      `target_range: neutral_max (${rule.neutral_max}) < bull_max (${rule.bull_max}).`);
  }
  // bull_min <= bull_max
  if (isNum(rule.bull_min) && isNum(rule.bull_max) && rule.bull_min! > rule.bull_max!) {
    report("ERROR", "threshold_order", loc,
      `target_range: bull_min (${rule.bull_min}) > bull_max (${rule.bull_max}).`);
  }
  // neutral_min <= neutral_max
  if (isNum(rule.neutral_min) && isNum(rule.neutral_max) && rule.neutral_min! > rule.neutral_max!) {
    report("ERROR", "threshold_order", loc,
      `target_range: neutral_min (${rule.neutral_min}) > neutral_max (${rule.neutral_max}).`);
  }
}

// ---------------------------------------------------------------------------
// 4) Metric library sanity
// ---------------------------------------------------------------------------

function validateMetricLibrary(data: ProfileRoot): void {
  const ml = data.metric_library;
  let identicalLabelCount = 0;
  const totalWithEs = { count: 0 };

  for (const [id, entry] of Object.entries(ml)) {
    const loc = `metric_library.${id}`;

    // Required fields: id is the key, must have some label and some description/why
    const hasLabel = !!(entry.label_en || entry.label || entry.label_es);
    if (!hasLabel) {
      report("ERROR", "metric_library_label", loc,
        `Missing label (no label_en, label, or label_es).`);
    }

    const hasDesc = !!(entry.description_en || entry.description || entry.why);
    if (!hasDesc) {
      report("ERROR", "metric_library_description", loc,
        `Missing description (no description_en, description, or why).`);
    }

    // Statement type validation
    if (entry.statement && !ALLOWED_STATEMENTS.has(entry.statement)) {
      report("WARNING", "metric_library_statement", loc,
        `Unknown statement type "${entry.statement}".`);
    }

    // label_es vs label_en identity check
    if (entry.label_es && entry.label_en) {
      totalWithEs.count++;
      if (entry.label_es === entry.label_en) {
        identicalLabelCount++;
      }
    }
  }

  // Check if >80% of labels are identical (data completeness warning)
  if (totalWithEs.count > 0) {
    const pct = identicalLabelCount / totalWithEs.count;
    if (pct > 0.8) {
      report("WARNING", "metric_library_i18n", "metric_library",
        `${(pct * 100).toFixed(0)}% of label_es values are identical to label_en (${identicalLabelCount}/${totalWithEs.count}). Consider providing proper Spanish translations.`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5) Template sanity
// ---------------------------------------------------------------------------

function validateTemplates(data: ProfileRoot, doFix: boolean): void {
  const ml = data.metric_library;

  for (const [name, tmpl] of Object.entries(data.templates)) {
    const loc = `templates.${name}`;
    const categories: (keyof TemplateEntry)[] = ["core", "secondary", "risk"];

    for (const cat of categories) {
      const list = tmpl[cat];
      if (!Array.isArray(list)) continue;

      // Missing from metric_library
      for (const id of list) {
        if (id && !(id in ml)) {
          report("ERROR", "template_missing_metric", `${loc}.${cat}`,
            `Metric "${id}" not found in metric_library.`);
        }
      }

      // Duplicates
      const seen = new Set<string>();
      const dupes: string[] = [];
      for (const id of list) {
        if (seen.has(id)) dupes.push(id);
        seen.add(id);
      }
      if (dupes.length > 0) {
        report("WARNING", "template_duplicate", `${loc}.${cat}`,
          `Duplicate metric(s): ${[...new Set(dupes)].join(", ")}`);
        if (doFix) {
          (tmpl as unknown as Record<string, unknown>)[cat] = dedupe(list);
          fixes.push({
            location: `${loc}.${cat}`,
            description: `Deduplicated: removed ${dupes.length} duplicate(s).`,
          });
        }
      }
    }

    // Cross-category overlaps (templates: core > risk > secondary)
    const coreSet = new Set(tmpl.core ?? []);
    const secSet = new Set(tmpl.secondary ?? []);
    const riskSet = new Set(tmpl.risk ?? []);

    const coreSec = intersection(coreSet, secSet);
    const coreRisk = intersection(coreSet, riskSet);
    const secRisk = intersection(secSet, riskSet);

    if (coreSec.size > 0) {
      report("WARNING", "template_overlap", loc,
        `core/secondary overlap: ${[...coreSec].join(", ")}`);
      if (doFix) {
        tmpl.secondary = tmpl.secondary.filter(m => !coreSec.has(m));
        fixes.push({
          location: `${loc}.secondary`,
          description: `Removed overlap with core: ${[...coreSec].join(", ")}`,
        });
      }
    }
    if (coreRisk.size > 0) {
      report("WARNING", "template_overlap", loc,
        `core/risk overlap: ${[...coreRisk].join(", ")}`);
      if (doFix) {
        tmpl.risk = tmpl.risk.filter(m => !coreRisk.has(m));
        fixes.push({
          location: `${loc}.risk`,
          description: `Removed overlap with core: ${[...coreRisk].join(", ")}`,
        });
      }
    }
    if (secRisk.size > 0) {
      report("WARNING", "template_overlap", loc,
        `secondary/risk overlap: ${[...secRisk].join(", ")}`);
      if (doFix) {
        // Templates: risk wins over secondary
        tmpl.secondary = tmpl.secondary.filter(m => !secRisk.has(m));
        fixes.push({
          location: `${loc}.secondary`,
          description: `Removed overlap with risk (risk wins): ${[...secRisk].join(", ")}`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 6) Metric weights (gics_profile_index)
// ---------------------------------------------------------------------------

function validateMetricWeights(data: ProfileRoot): void {
  const gpi = data.gics_profile_index;
  if (!gpi) return;

  const ml = data.metric_library;

  for (const [code, node] of Object.entries(gpi)) {
    const loc = `gics_profile_index.${code}`;

    // metric_weights
    const mw = node.metric_weights;
    if (mw && Object.keys(mw).length > 0) {
      const total = Object.values(mw).reduce((a, b) => a + b, 0);
      if (Math.abs(total - 1.0) > 0.02) {
        report("ERROR", "metric_weight_sum", loc,
          `metric_weights sum = ${total.toFixed(4)} (expected ~1.0, tolerance 0.02).`);
      }
      for (const [mid, w] of Object.entries(mw)) {
        if (!(mid in ml)) {
          report("ERROR", "metric_weight_ref", loc,
            `metric_weights references "${mid}" which is not in metric_library.`);
        }
        if (w < 0) {
          report("ERROR", "metric_weight_negative", loc,
            `Negative weight ${w} for metric "${mid}".`);
        }
      }
    }

    // bucket_weights
    const bw = node.bucket_weights;
    if (bw && Object.keys(bw).length > 0) {
      const total = Object.values(bw).reduce((a, b) => a + b, 0);
      if (Math.abs(total - 1.0) > 0.02) {
        report("ERROR", "bucket_weight_sum", loc,
          `bucket_weights sum = ${total.toFixed(4)} (expected ~1.0, tolerance 0.02).`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Add universal metrics at template level
// ---------------------------------------------------------------------------

interface Phase2Metric {
  id: string;
  libraryEntry: MetricLibraryEntry;
  scoringRule: ScoringRule;
}

const PHASE2_METRICS: Phase2Metric[] = [
  {
    id: "roe",
    libraryEntry: {
      label_es: "ROE",
      label: "ROE",
      label_en: "ROE",
      statement: "derived",
      formula: "Net Income / Avg Equity",
      why: "Measures capital efficiency and return generation.",
    },
    scoringRule: {
      type: "higher_better",
      unit: "percent",
      bull_min: 15,
      neutral_min: 10,
      neutral_max: 15,
      bear_max: 10,
    },
  },
  {
    id: "roa",
    libraryEntry: {
      label_es: "ROA",
      label: "ROA",
      label_en: "ROA",
      statement: "derived",
      formula: "Net Income / Avg Assets",
      why: "Measures capital efficiency and return generation.",
    },
    scoringRule: {
      type: "higher_better",
      unit: "percent",
      bull_min: 8,
      neutral_min: 4,
      neutral_max: 8,
      bear_max: 4,
    },
  },
  {
    id: "net_income_growth_yoy",
    libraryEntry: {
      label_es: "Net Income YoY Growth",
      label: "Net Income YoY Growth",
      label_en: "Net Income YoY Growth",
      statement: "derived",
      formula: "(Net Income_t - Net Income_{t-1}) / |Net Income_{t-1}|",
      why: "Tracks bottom-line earnings momentum year over year.",
      watch_for: "Watch for one-time items, tax changes, and base-year effects.",
    },
    scoringRule: {
      type: "higher_better",
      unit: "percent",
      bull_min: 12,
      neutral_min: 4,
      neutral_max: 12,
      bear_max: 4,
    },
  },
  {
    id: "eps_diluted_growth_yoy",
    libraryEntry: {
      label_es: "Diluted EPS YoY Growth",
      label: "Diluted EPS YoY Growth",
      label_en: "Diluted EPS YoY Growth",
      statement: "derived",
      formula: "(EPS Diluted_t - EPS Diluted_{t-1}) / |EPS Diluted_{t-1}|",
      why: "Measures per-share earnings growth, adjusting for dilution.",
      watch_for: "Watch for buyback effects and share issuance that distort per-share metrics.",
    },
    scoringRule: {
      type: "higher_better",
      unit: "percent",
      bull_min: 12,
      neutral_min: 4,
      neutral_max: 12,
      bear_max: 4,
    },
  },
  {
    id: "ebitda_growth_yoy",
    libraryEntry: {
      label_es: "EBITDA YoY Growth",
      label: "EBITDA YoY Growth",
      label_en: "EBITDA YoY Growth",
      statement: "derived",
      formula: "(EBITDA_t - EBITDA_{t-1}) / |EBITDA_{t-1}|",
      why: "Tracks operating earnings growth before non-cash charges and financing.",
      watch_for: "Watch for restructuring charges and one-time items in EBITDA.",
    },
    scoringRule: {
      type: "higher_better",
      unit: "percent",
      bull_min: 10,
      neutral_min: 3,
      neutral_max: 10,
      bear_max: 3,
    },
  },
];

function applyPhase2(data: ProfileRoot): void {
  const ml = data.metric_library;
  const sr = data.scoring_rules;
  const templates = data.templates;

  for (const metric of PHASE2_METRICS) {
    // Add to metric_library if missing
    if (!(metric.id in ml)) {
      ml[metric.id] = metric.libraryEntry;
      fixes.push({
        location: `metric_library.${metric.id}`,
        description: `Added metric_library entry for "${metric.id}".`,
      });
    }

    // Add to scoring_rules if missing
    if (!(metric.id in sr)) {
      sr[metric.id] = metric.scoringRule;
      fixes.push({
        location: `scoring_rules.${metric.id}`,
        description: `Added scoring_rule for "${metric.id}".`,
      });
    }
  }

  // Add to base_nonfinancial template (secondary) if not already present
  const baseTemplate = templates.base_nonfinancial;
  if (baseTemplate) {
    const allInTemplate = new Set([
      ...baseTemplate.core,
      ...baseTemplate.secondary,
      ...baseTemplate.risk,
    ]);

    for (const metric of PHASE2_METRICS) {
      if (!allInTemplate.has(metric.id)) {
        baseTemplate.secondary.push(metric.id);
        fixes.push({
          location: `templates.base_nonfinancial.secondary`,
          description: `Added "${metric.id}" to secondary metrics.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function intersection(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const item of a) {
    if (b.has(item)) result.add(item);
  }
  return result;
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

function collectAllMetricRefs(data: ProfileRoot): Set<string> {
  const refs = new Set<string>();

  function walkTree(nodes: GicsTreeNode[]): void {
    for (const node of nodes) {
      const wl = node.watchlist;
      if (wl) {
        for (const cat of ["core", "secondary", "risk"] as const) {
          for (const id of wl[cat] ?? []) {
            if (id) refs.add(id);
          }
        }
      }
      if (node.children) walkTree(node.children);
    }
  }
  walkTree(data.gics_tree);

  for (const tmpl of Object.values(data.templates)) {
    for (const cat of ["core", "secondary", "risk"] as const) {
      for (const id of (tmpl as TemplateEntry)[cat] ?? []) {
        if (id) refs.add(id);
      }
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateMarkdown(title: string): string {
  const errors = diagnostics.filter(d => d.severity === "ERROR");
  const warnings = diagnostics.filter(d => d.severity === "WARNING");

  let md = `# ${title}\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `| Severity | Count |\n`;
  md += `|----------|-------|\n`;
  md += `| ERROR    | ${errors.length} |\n`;
  md += `| WARNING  | ${warnings.length} |\n`;
  md += `| **Total** | **${diagnostics.length}** |\n\n`;

  if (errors.length > 0) {
    md += `## Errors\n\n`;
    md += `| Rule | Location | Message |\n`;
    md += `|------|----------|---------|\n`;
    for (const d of errors) {
      md += `| ${d.rule} | \`${d.location}\` | ${d.message} |\n`;
    }
    md += `\n`;
  }

  if (warnings.length > 0) {
    md += `## Warnings\n\n`;
    md += `| Rule | Location | Message |\n`;
    md += `|------|----------|---------|\n`;
    for (const d of warnings) {
      md += `| ${d.rule} | \`${d.location}\` | ${d.message} |\n`;
    }
    md += `\n`;
  }

  if (fixes.length > 0) {
    md += `## Changes Applied\n\n`;
    md += `| Location | Description |\n`;
    md += `|----------|-------------|\n`;
    for (const f of fixes) {
      md += `| \`${f.location}\` | ${f.description} |\n`;
    }
    md += `\n`;
  }

  if (diagnostics.length === 0) {
    md += `All checks passed. No issues found.\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const doFix = args.includes("--fix");

  // Load JSON
  const raw = readFileSync(JSON_PATH, "utf-8");
  const data: ProfileRoot = JSON.parse(raw);

  console.log(`Validating: ${JSON_PATH}`);
  console.log(`Mode: ${doFix ? "validate + fix" : "validate only"}\n`);

  // Run all validation rules
  validateWatchlistRefs(data, doFix);
  validateRuleCoverage(data);
  validateScoringRules(data);
  validateMetricLibrary(data);
  validateTemplates(data, doFix);
  validateMetricWeights(data);

  // Count issues before phase 2
  const prePhase2Errors = diagnostics.filter(d => d.severity === "ERROR").length;

  // Phase 2: only if --fix is used AND no errors remain after fixes
  if (doFix && prePhase2Errors === 0) {
    applyPhase2(data);
    console.log("Phase 2: Applied universal metric enhancements.\n");
  }

  // Summary output
  const errors = diagnostics.filter(d => d.severity === "ERROR");
  const warnings = diagnostics.filter(d => d.severity === "WARNING");

  console.log("=== Validation Results ===");
  console.log(`  Errors:   ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  if (fixes.length > 0) {
    console.log(`  Fixes:    ${fixes.length}`);
  }
  console.log();

  // Print each diagnostic
  for (const d of diagnostics) {
    const prefix = d.severity === "ERROR" ? "ERROR" : "WARN ";
    console.log(`  [${prefix}] [${d.rule}] ${d.location}`);
    console.log(`           ${d.message}`);
  }

  if (fixes.length > 0) {
    console.log("\n=== Fixes Applied ===");
    for (const f of fixes) {
      console.log(`  [FIX] ${f.location}`);
      console.log(`        ${f.description}`);
    }
  }

  // Write reports
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const reportPath = resolve(REPORTS_DIR, "gics_profile_validation.md");
  writeFileSync(reportPath, generateMarkdown("GICS Profile Validation Report"), "utf-8");
  console.log(`\nReport written to: ${reportPath}`);

  // Write fixed JSON + fixed report
  if (doFix && fixes.length > 0) {
    writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`Fixed JSON written to: ${JSON_PATH}`);

    const fixedReportPath = resolve(REPORTS_DIR, "gics_profile_validation_fixed.md");
    writeFileSync(fixedReportPath, generateMarkdown("GICS Profile Validation Report (Fixed)"), "utf-8");
    console.log(`Fixed report written to: ${fixedReportPath}`);
  }

  // Exit code
  if (errors.length > 0) {
    console.log("\nValidation FAILED with errors.");
    process.exit(1);
  } else {
    console.log("\nValidation PASSED.");
    process.exit(0);
  }
}

main();
