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

Place these files in `public/` so they are served at the site root:

- `public/gics_watchlist_scorecard_profile_en.json` → `GET /gics_watchlist_scorecard_profile_en.json`
- `public/locale_es.json` → `GET /locale_es.json` (only when ES)

Note: `/data/...` is still supported as a fallback for backwards compatibility.

## Features

- EN/ES language switch using dictionary keys (ES loaded lazily once)
- Granularity selector: sector / industry_group / industry / sub_industry
- Left tree navigation with collapsible hierarchy
- Search by code or localized name
- Deep node detail with templates, buckets, metrics, scoring rules, and overrides
- Copy node summary as Markdown
- Download node JSON
- Legacy GICS code migration (deprecated codes automatically mapped to current ones)
- Persistent selection via localStorage and URL query parameters (`?gics=<code>`)
- Responsive design with portrait/landscape optimizations

## Architecture

```
src/
├── data/               Data loading, indexing, and profile resolution
│   ├── loader.ts         JSON fetching with fallback endpoints
│   ├── indexer.ts        Search index builder for tree navigation
│   ├── gicsCodeMigration.ts  Legacy GICS code mapping
│   └── profileResolver.ts   Core business logic: profile resolution from tree/index
├── ui/                 React components
│   ├── Navbar.tsx        Top navigation (language, granularity, search)
│   ├── SearchBox.tsx     Autocomplete search dropdown
│   ├── TreeNav.tsx       Hierarchical tree navigation
│   ├── NodeDetail.tsx    Full node detail view
│   ├── MetricTable.tsx   Tabbed metrics table
│   └── utils.ts          Formatting and markdown export utilities
├── i18n/               Internationalization (EN/ES)
│   ├── i18n.tsx          React context provider and useI18n hook
│   └── translate.ts      Key-based translation function
├── types.ts            Application TypeScript type definitions
├── App.tsx             Main application component (state management)
└── main.tsx            React entry point
```

## Type system

- `src/types.ts` — authoritative types used by the application
- `types.ts` (root) — full reference schema including types for data-generation tooling

## Testing

```bash
npm run test
# or without npm_config_http_proxy warnings:
npm run test:vitest:coverage
```

This runs Vitest in coverage mode (`vitest run --coverage`).

Tests cover: data loading, indexing, profile resolution (with full graph validation), GICS code migration, i18n translation, and UI utilities.
