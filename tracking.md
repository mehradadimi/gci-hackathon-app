# GCI — Build Tracking Log

> Cursor: After each STEP in `development-plan.md`, append a new entry below.

## Log Format (append newest at top)

### [YYYY-MM-DD HH:MM] STEP X — <Step Title>
- Summary: <2–3 lines of what was done>
- Files: <comma-separated>
- Notes/Risks: <optional, short>
- Commit: "<exact message>"

---

### [____ ____] (placeholder)
### [2025-09-26 10:00] STEP 0 — Project Scaffolding
- Summary: Scaffolded Next.js (App Router) + TypeScript, installed Tailwind per guide, created required folders/files, added env and deps. Verified dev server renders `/`.
- Files: package.json, next.config.mjs, tsconfig.json, .gitignore, .env.local, postcss.config.js, tailwind.config.ts, app/layout.tsx, app/page.tsx, app/globals.css, src/server/.gitkeep, src/lib/.gitkeep, src/components/.gitkeep, public/charts/.gitkeep, data/.gitkeep
- Commit: "chore: scaffold Next.js + Tailwind + docs"

### [2025-09-26 20:20] STEP 1 — DB Schema & Repo
- Summary: Implemented SQLite schema (`data/gci.db`) and typed repo with companies CRUD. Added test endpoint to seed and read back AAPL, MSFT, NVDA, GOOGL.
- Files: src/server/db.ts, src/server/repo.ts, app/api/test/companies/route.ts
- Notes/Risks: Dev server port reuse can cause EADDRINUSE; ensure one instance.
- Commit: "feat: sqlite schema + repository helpers"
### [2025-09-26 20:25] STEP 2 — Ticker→CIK Mapping (Core for “any company”)
- Summary: Added SEC company tickers downloader with 7-day cache, CIK 10-digit mapping, admin force-refresh endpoint, and test endpoint to print CIKs for AAPL/MSFT/NVDA/GOOGL.
- Files: src/server/cik.ts, app/api/admin/refresh-tickers/route.ts, app/api/test/ciks/route.ts
- Commit: "feat: ticker→CIK map (company_tickers.json)"
### [2025-09-26 20:35] STEP 3 — SEC Client (Submissions & XBRL)
- Summary: Implemented SEC client with 24h disk cache and User-Agent header. Test route fetches submissions and Revenues concept for two CIKs and returns JSON shape summary.
- Files: src/server/sec.ts, app/api/test/sec/route.ts
- Commit: "feat: SEC API client + disk cache"
### [2025-09-26 20:45] STEP 4 — Guidance Parser (8‑K Exhibit 99.1)
- Summary: Added guidance extractor using Cheerio and regex to find and normalize revenue/EPS ranges; upserts periods/guidance. Test route runs on two non‑AAPL tickers and returns normalized arrays.
- Files: src/server/guidance.ts, app/api/test/guidance/route.ts, src/server/repo.ts
- Commit: "feat: guidance extraction (Exhibit 99.1) → DB"
### [2025-09-26 20:55] STEP 5 — Actuals Fetcher (XBRL Company Facts)
- Summary: Implemented XBRL actuals fetcher for Revenues and EPS Diluted; aligns by fy/fp; stores normalized actuals with provenance URLs. Test route runs for two tickers and reports presence flags.
- Files: src/server/actuals.ts, app/api/test/actuals/route.ts, src/server/repo.ts
- Commit: "feat: actuals via XBRL → DB"
