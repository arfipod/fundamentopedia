# GICS Encyclopedia

React + Vite + TypeScript + Bootstrap 5 single-page app for browsing the GICS watchlist/scorecard profile.

## Setup

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## Data files (important)

Place these files in `public/` so they are served from site root:

- `public/gics_watchlist_scorecard_profile_en.json`
- `public/locale_es.json`

The app fetches at runtime:

- `/gics_watchlist_scorecard_profile_en.json`
- `/locale_es.json` (only when switching language to ES)

Do not place them under `/data`.

## Features

- EN/ES language switch using dictionary keys (ES loaded lazily once)
- Granularity selector: sector / industry_group / industry / sub_industry
- Left tree navigation with collapsible hierarchy
- Search by code or localized name
- Deep node detail with templates, buckets, metrics, scoring rules, and overrides
- Copy node summary as Markdown
- Download node JSON

## Testing

```bash
npm run test
```

This runs Vitest in coverage mode (`vitest run --coverage`).
