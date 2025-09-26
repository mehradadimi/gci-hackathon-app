GCI — Guidance Credibility Index

2-minute demo

1. Install & run
   - pnpm install
   - pnpm dev
2. Open http://localhost:3008
   - Try the demo set: click the CTA or search AAPL, MSFT, NVDA, GOOGL, COST.
3. If a company is empty on first load, go to /admin/import:
   - Enter tickers (comma-separated)
   - Click steps: Fetch Filings → Parse Guidance → Pull Actuals → Analyze Language → Score GCI
   - Open /company/{ticker} to view badge, timeline, language chips, and sources

Notes:
- SEC UA is required: .env.local has SEC_UA="GCI-Hackathon/1.0 (contact: you@example.com)" (update contact).
- We use delivered-only fallback for timelines when guidance isn’t parsed yet.
- NVDA newsroom parsing supports $54.0B ±2% style; MSFT IR adapter targets segment ranges.

