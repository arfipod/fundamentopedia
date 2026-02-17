# GICS Profile Validation Report (Fixed)

Generated: 2026-02-17T07:59:26.060Z

## Summary

| Severity | Count |
|----------|-------|
| ERROR    | 0 |
| WARNING  | 8 |
| **Total** | **8** |

## Warnings

| Rule | Location | Message |
|------|----------|---------|
| metric_library_i18n | `metric_library` | 100% of label_es values are identical to label_en (157/157). Consider providing proper Spanish translations. |
| template_overlap | `templates.base_specialty_finance` | secondary/risk overlap: debt_maturity_profile |
| template_overlap | `templates.base_mortgage_reit` | secondary/risk overlap: debt_maturity_profile |
| template_overlap | `templates.base_shipping` | secondary/risk overlap: debt_maturity_profile |
| template_overlap | `templates.base_biotech` | secondary/risk overlap: share_count_change |
| template_overlap | `templates.base_managed_care` | core/risk overlap: medical_loss_ratio |
| template_overlap | `templates.base_mining` | secondary/risk overlap: working_capital_change |
| template_overlap | `templates.base_midstream` | secondary/risk overlap: debt_maturity_profile |

## Changes Applied

| Location | Description |
|----------|-------------|
| `templates.base_specialty_finance.secondary` | Removed overlap with risk (risk wins): debt_maturity_profile |
| `templates.base_mortgage_reit.secondary` | Removed overlap with risk (risk wins): debt_maturity_profile |
| `templates.base_shipping.secondary` | Removed overlap with risk (risk wins): debt_maturity_profile |
| `templates.base_biotech.secondary` | Removed overlap with risk (risk wins): share_count_change |
| `templates.base_managed_care.risk` | Removed overlap with core: medical_loss_ratio |
| `templates.base_mining.secondary` | Removed overlap with risk (risk wins): working_capital_change |
| `templates.base_midstream.secondary` | Removed overlap with risk (risk wins): debt_maturity_profile |
| `metric_library.net_income_growth_yoy` | Added metric_library entry for "net_income_growth_yoy". |
| `scoring_rules.net_income_growth_yoy` | Added scoring_rule for "net_income_growth_yoy". |
| `metric_library.eps_diluted_growth_yoy` | Added metric_library entry for "eps_diluted_growth_yoy". |
| `scoring_rules.eps_diluted_growth_yoy` | Added scoring_rule for "eps_diluted_growth_yoy". |
| `metric_library.ebitda_growth_yoy` | Added metric_library entry for "ebitda_growth_yoy". |
| `scoring_rules.ebitda_growth_yoy` | Added scoring_rule for "ebitda_growth_yoy". |
| `templates.base_nonfinancial.secondary` | Added "roe" to secondary metrics. |
| `templates.base_nonfinancial.secondary` | Added "roa" to secondary metrics. |
| `templates.base_nonfinancial.secondary` | Added "net_income_growth_yoy" to secondary metrics. |
| `templates.base_nonfinancial.secondary` | Added "eps_diluted_growth_yoy" to secondary metrics. |
| `templates.base_nonfinancial.secondary` | Added "ebitda_growth_yoy" to secondary metrics. |

