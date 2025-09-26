# GCI — Page Flow / Site Map

## Routes
- `/`  (Landing)
  - Pitch + input for tickers (multi-select) and "Demo Set" button.
  - CTA → "Compute GCI".

- `/company/[ticker]`
  - Header: Company name, ticker, GCI badge, 1-sentence rationale.
  - Section A: **Promised vs Delivered** mini-timeline (last up to 4 periods).
  - Section B: **Language Risk** chips (hedges/1k, uncertainty/1k) + snippet view.
  - Section C: **Breakdown** (TRA, CVP, LR) with tooltips and formula.
  - Section D: **Provenance** links: “Open 8-K” and “Open Transcript”.

- `/admin/import` (hidden link)
  - Input: tickers list
  - Buttons: “Fetch Filings”, “Parse Guidance”, “Pull Actuals”, “Analyze Language”, “Score GCI”.
  - Shows step logs for debugging during demo.

## Success Criteria Per Page
- Landing: sub-2s render, no blocking; demo set works offline (cached).
- Company: numbers match DB; links open real sources; tooltips explain metrics.
- Admin: each button logs OK/FAIL; retry is idempotent.

## States
- Loading, Ready, Error (per section).
- Empty states with friendly copy.

## Visuals
- Clean cards, badges (High/Medium/Low), timeline sparkbars, chip list for red flags.

## Accessibility
- Keyboard nav, aria labels for charts.

## Telemetry (optional)
- Console timing marks; no external beacons.
