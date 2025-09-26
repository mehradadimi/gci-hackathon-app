# GCI — Markdown Development Plan (Cursor-Followable)

> You (Cursor) are the coding agent. Follow this plan **in order**. After each numbered STEP is completed and tested, **append a brief entry to `tracking.md`** and **commit** with the provided message. Keep context tight: only open files needed for the current step.

## SETUP

STEP 0 — Project Scaffolding
- Create a Next.js (App Router) + TypeScript project with Tailwind.
- Add a simple Express/Node or Next API routes for server tasks.
- Add `sqlite3` (or `better-sqlite3`) and create `gci.db`.
- Create folders: `src/server`, `src/lib`, `src/components`, `prisma` (optional).
- Create files from this repo root: `project-brief.md`, `database-design.md`, `page-flow.md`, `development-plan.md`, `.cursorrules`, `tracking.md`.
**Test:** `pnpm dev` renders a landing page with placeholder.
**Commit:** "chore: scaffold app + docs"

## DATA LAYER

STEP 1 — DB Schema & Helpers
- Implement the tables per `database-design.md` with a migration script.
- Add `src/server/db.ts` (open connection, helpers).
**Test:** Insert a mock company row; query it back.
**Commit:** "feat: sqlite schema + db helpers"

STEP 2 — SEC Client (Submissions & XBRL)
- Build `src/server/sec.ts`:
  - `getCompanySubmissions(cik)`
  - `findRecent8KsWithItem202()` → returns filing + exhibit URLs
  - `getCompanyConcept(cik, tag)` for `us-gaap:Revenues`, `us-gaap:EarningsPerShareDiluted`
- Set **User-Agent** header per SEC guidance. :contentReference[oaicite:5]{index=5}
**Test:** Hardcode one CIK; confirm JSON returns.
**Commit:** "feat: SEC API client"

STEP 3 — Guidance Parser
- Build `src/server/guidance.ts`:
  - Fetch Exhibit 99.1 HTML; extract "Guidance/Outlook" blocks.
  - Regex for revenue/EPS ranges or points; normalize units (M/B).
  - Return `{ period, metric, min, max, units, basis, extracted_text }`.
- Store in `guidance` linked to a `period` row (create if missing).
**Test:** Run on 1–2 known filings; log extracted JSON.
**Commit:** "feat: guidance extraction pipeline"  
(Example 8-K exhibits for testing) :contentReference[oaicite:6]{index=6}

STEP 4 — Actuals Fetcher
- Build `src/server/actuals.ts`:
  - For each `period`+metric, call Company Facts API for the aligned `fy/fp` and extract the value.
  - Store in `actuals`.
**Test:** For the same tickers as STEP 3, verify values exist.
**Commit:** "feat: actuals via XBRL company facts" :contentReference[oaicite:7]{index=7}

STEP 5 — Transcript Fetch + Language Metrics
- Build `src/server/transcript.ts`:
  - Given `ticker` and approximate date, fetch a recent transcript (Motley Fool or provided URL).
  - Extract Q&A section text; compute per-1k metrics: `hedges`, `negations`, `uncertainty`, `vague`.
  - Save to `language_metrics`.
**Test:** For 1 ticker, print counts and words_total.
**Commit:** "feat: transcript language metrics" :contentReference[oaicite:8]{index=8}

STEP 6 — GCI Scoring
- Build `src/server/score.ts`:
  - For last up to 4 guided periods with actuals: compute per-period error `e = |actual - guidedMid| / guidedMid` (clamp 0–0.5).
  - TRA = `100 * (1 - avg(e))`
  - CVP = `100 * (1 - min(std(e)/0.1, 1))`
  - LR  = normalize inverse of hedges+uncertainty density to 0–100.
  - GCI = `0.5*TRA + 0.2*CVP + 0.3*LR`
  - Badge: High (≥80), Medium (60–79), Low (<60).
  - Generate a 1-sentence rationale (OpenAI API optional).
- Save to `scores`.
**Test:** Log score components and badge for each period.
**Commit:** "feat: scoring engine (TRA/CVP/LR → GCI)"

## UI

STEP 7 — Company Page
- Route `/company/[ticker]`
- Fetch from DB: latest `scores` (+ components), `guidance`, `actuals`, `language_metrics`.
- Render: badge, rationale, mini-timeline (bar pairs), chips (red flags).
- Add links out to filing and transcript URLs.
**Test:** Manual visual check; empty states.
**Commit:** "feat: company detail page"

STEP 8 — Landing & Admin
- Landing: ticker multi-select + “Demo Set”; navigate to first company.
- Admin `/admin/import`: buttons invoke API handlers in order (fetch filings → parse guidance → actuals → language → score).
**Test:** Click-through demo flow works.
**Commit:** "feat: landing + admin import flow"

## POLISH

STEP 9 — Caching & Error UX
- Cache HTTP responses (SEC/transcripts) on disk.
- Show inline error toasts; keep last good score.
**Test:** Simulate failed fetch; app doesn’t crash.
**Commit:** "chore: caching + resilient UX"

STEP 10 — Demo Content + Readme
- Seed 3–5 tickers with pre-fetched rows (JSON seeds).
- Add README demo script.
**Test:** Dry-run the 2-minute demo.
**Commit:** "docs: demo seeds + instructions"

## DONE
- Announce in `tracking.md`: “MVP complete; ready to demo.”
