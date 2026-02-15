# GICS Encyclopedia (React + Vite + TypeScript + Bootstrap)

A small SPA that turns your **GICS watchlist / scorecard profile JSON** into an interactive “encyclopedia”.
It lets you choose **granularity** (Sector → Industry Group → Industry → Sub-Industry), browse via a tree, search by code/name, and see the full set of metrics + buckets + rules + overrides for each node.

## What you need to place in `public/` (served at site root)

Put these files **in the Vite `public/` folder** so they are accessible at the site root:

- `public/gics_watchlist_scorecard_profile_en.json`
- `public/locale_es.json`

They will be fetched at runtime as:
- `GET /gics_watchlist_scorecard_profile_en.json`
- `GET /locale_es.json` (only when language = ES)

> **Fallback:** The loader also tries `/data/...` paths as a fallback for backwards compatibility.

> Keeping the canonical dataset in English avoids data duplication.
> Spanish is loaded via `locale_es.json` using stable translation keys (1:1 by ID/code).

## Install & run

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Bootstrap

Install:

```bash
npm i bootstrap
```

Then import once (e.g. in `src/main.tsx`):

```ts
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
```

## Localization design (no duplication)

The app uses a tiny dictionary-based i18n:

- EN is the canonical dataset strings.
- ES uses `locale_es.json` keys like:

- `gics.name.<code>` — node display names
- `bucket.label.<bucket_id>`, `bucket.desc.<bucket_id>` — bucket labels/descriptions
- `template.notes.<template_id>` — template descriptions
- `metric.label.<metric_id>`, `metric.why.<metric_id>`, `metric.watch_for.<metric_id>` — metric details
- `scoring.note.<metric_id>` — scoring rule notes
- `override.note.<code>.<metric_id>` — threshold override notes
- `ui.*` — interface labels (tabs, column headers, buttons, navigation, etc.)

If a translation key is missing, the UI falls back to the canonical English strings.

## Extending the encyclopedia

Typical extensions:
- Add more UI sections (e.g., “2-minute scorecard”, KPI highlights, peer comparisons).
- Add more translation keys in `locale_es.json` (it’s safe; unknown keys are ignored).
- Add more templates / overrides in the canonical JSON and reload.

## Data shape

See `src/types.ts` for the TypeScript interfaces that match the provided JSON profile structure
(`gics_profile_index`, `gics_tree`, `metric_library`, `scorecard_config`, `scoring_rules`, etc.).


## Troubleshooting

If your environment injects `npm_config_http_proxy` / `npm_config_https_proxy`, npm may print warnings.
Use `npm run test:vitest` or `npm run test:vitest:coverage`, which run Vitest via `scripts/run-vitest.sh` after unsetting those vars.
