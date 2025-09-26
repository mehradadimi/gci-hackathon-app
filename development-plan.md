# GCI — Markdown Development Plan (Cursor-Followable, Multi-Company, Visual, Auto-Deploy)

> You (Cursor) are the coding agent. Follow this plan **in order**. After each numbered STEP is completed and tested, **append a brief entry to `tracking.md`** and **commit** with the provided message. Keep context tight: open only the files needed for the current step.  
> **Important**: When a STEP says **ASK USER**, pause and ask the exact questions shown, then proceed using the answers.

---

## SETUP

**STEP 0 — Project Scaffolding**
- Create a **Next.js (App Router)** + **TypeScript** project.
- Install **Tailwind CSS** (per Tailwind Next.js guide).
- Create folders: `app`, `src/server`, `src/lib`, `src/components`, `public/charts`, `.cache`, `data`.
- Add files at repo root: `project-brief.md`, `database-design.md`, `page-flow.md`, `development-plan.md`, `.cursorrules`, `tracking.md`, `ui-style-guide.md`.
- Add env: `.env.local` with `SEC_UA="GCI-Hackathon/1.0 (contact: you@example.com)"` (SEC requires a descriptive **User‑Agent**).
- Add deps: `better-sqlite3` (or `sqlite3`), `zod`, `cheerio`, `quickchart-js`.
**Test:** `pnpm dev` renders the landing page skeleton at `/`.  
**Commit:** `chore: scaffold Next.js + Tailwind + docs`

> Refs: Next.js on Vercel (zero‑config); Tailwind Next.js install.  
> Sources: vercel.com/docs/frameworks/full-stack/nextjs; tailwindcss.com/docs/guides/nextjs.  

---

## DATA LAYER (Multi-company by design)

**STEP 1 — DB Schema & Repo**
- Implement tables from `database-design.md` using **SQLite** (`data/gci.db`).
- Create `src/server/db.ts` and `src/server/repo.ts` with typed CRUD for: companies, periods, guidance, actuals, language_metrics, scores.
**Test:** Insert 4 companies (AAPL, MSFT, NVDA, GOOGL) and read them back.  
**Commit:** `feat: sqlite schema + repository helpers`

**STEP 2 — Ticker→CIK Mapping (Core for “any company”)**
- Create `src/server/cik.ts` with:
  - `loadCompanyTickers()` → download SEC **company_tickers.json** to `./.cache/company_tickers.json`; return a Map keyed by UPPERCASE ticker with `{ cik10, name }` (CIK **zero‑padded to 10** digits).
  - `getCIKByTicker(t)` → returns `cik10` or throws if not found.
- Refresh cache if older than 7 days; expose `/api/admin/refresh-tickers` to force refresh.
**Test:** Print 10‑digit CIKs for `AAPL, MSFT, NVDA, GOOGL`.  
**Commit:** `feat: ticker→CIK map (company_tickers.json)`

> Refs: SEC Company Tickers mapping; SEC Developer Resources.  

**STEP 3 — SEC Client (Submissions & XBRL)**
- Create `src/server/sec.ts` with **User‑Agent** header from `process.env.SEC_UA`:
  - `getCompanySubmissions(cik10)` → `https://data.sec.gov/submissions/CIK##########.json`
  - `getCompanyConcept(cik10, tag)` → `https://data.sec.gov/api/xbrl/companyconcept/CIK##########/us-gaap/{Tag}.json`
- Add disk cache under `.cache/sec/` (24h TTL).
**Test:** Call both endpoints for two different CIKs and log JSON shapes.  
**Commit:** `feat: SEC API client + disk cache`

> Refs: SEC **companyconcept** endpoint & submissions index.  

**STEP 4 — Guidance Parser (8‑K Exhibit 99.1)**
- Create `src/server/guidance.ts`:
  - From `getCompanySubmissions`, find latest **8‑K** with **Item 2.02**; open **Exhibit 99.1** (earnings press release).
  - Fetch exhibit HTML, parse with **Cheerio**, find **Guidance/Outlook** sections or sentences containing **“expects / sees / outlook”**.
  - Extract metrics via regex; normalize units to **USD_M**; structure: `{ period, metric: "revenue"|"eps_diluted", min, max, units, basis, extracted_text }`.
  - Upsert `periods` and `guidance` rows.
**Test:** Run on **two non‑AAPL** tickers and log normalized JSON arrays.  
**Commit:** `feat: guidance extraction (Exhibit 99.1) → DB`

**STEP 5 — Actuals Fetcher (XBRL Company Facts)**
- Create `src/server/actuals.ts`:
  - For each `period`+metric, call **companyconcept** for `us-gaap:Revenues` and `us-gaap:EarningsPerShareDiluted`; align via `fy`/`fp`; store in `actuals` with provenance URL.
**Test:** For the same two tickers, verify `actuals` rows exist for each guided period.  
**Commit:** `feat: actuals via XBRL → DB`

**STEP 6 — Transcript Q&A + Language Metrics**
- Create `src/server/transcript.ts`:
  - Given `{ticker, approxDate}`, fetch a public transcript (e.g., Motley Fool) and isolate **Q&A** text.
  - Compute counts per 1k words for **hedges**, **negations**, **uncertainty**, **vague**; store in `language_metrics`.
**Test:** For **two tickers**, print `{words_total, hedges_per_k, uncertainty_per_k}` and save rows.  
**Commit:** `feat: transcript language metrics`

**STEP 7 — GCI Scoring**
- Create `src/server/score.ts`:
  - For last up to 4 guided periods with actuals:
    - `e = |actual − guidedMid| / guidedMid` (clamp 0–0.5)
    - `TRA = 100 * (1 − avg(e))`
    - `CVP = 100 * (1 − min(std(e)/0.1, 1))`
    - `LR` = inverse-normalized (hedges + uncertainty) density to 0–100
    - `GCI = 0.5*TRA + 0.2*CVP + 0.3*LR`
    - `badge`: High ≥ 80, Medium 60–79, Low < 60
  - Generate a one‑sentence rationale (LLM optional). Save to `scores`.
**Test:** Output table of `ticker, fy, fp, tra, cvp, lr, gci, badge` for **all processed tickers**.  
**Commit:** `feat: scoring engine (TRA/CVP/LR → GCI)`

---

## UI (Home + Company views, visually appealing)

**STEP 8 — UI Foundation (Tailwind + shadcn/ui)**
- Add shadcn/ui primitives from `ui-style-guide.md` (Card, Badge, Tooltip, Table).
- Create components:
  - `GciBadge` (green/amber/red variants + aria-label)
  - `MetricChips` (flag chips)
  - `TimelineChart` (uses QuickChart image; caches to `/public/charts`)
  - `SourceLinks` (buttons for 8‑K & Transcript)
**Test:** Render a sandbox route `/sandbox` to preview components.  
**Commit:** `feat: UI components (badge, chips, timeline, sources)`

> Refs: shadcn/ui docs; Tailwind guides.

**STEP 9 — Homepage (App Router)**
- Route: `/` (Home). Build a polished hero + search:
  - **Hero:** headline + subtext + CTA “Try Demo Set”
  - **Ticker search:** input with **typeahead** from `company_tickers` cache (case‑insensitive)
  - **Recent companies**: show last 6 viewed (localStorage)
  - **On submit:** validate ticker → `router.push("/company/[ticker]")`
**Test:** Enter `AAPL`, `MSFT`, `NVDA`, `GOOGL` → each routes correctly.  
**Commit:** `feat: homepage with ticker search + demo CTA`

**STEP 10 — Company Page (Dynamic ANY ticker)**
- Route: `/company/[ticker]` (dynamic) — **no hardcoding**.
- Load sequence:
  1) `getCIKByTicker(t)` → CIK
  2) Query DB for latest `guidance, actuals, language_metrics, scores`
  3) If missing, show an **Import CTA** to run admin pipeline
- Render:
  - Top card: **GCI Badge** + concise rationale
  - Timeline: **Promised vs Delivered** (QuickChart image)
  - **Language Risk** chips
  - **Breakdown** (TRA/CVP/LR) with tooltips
  - **SourceLinks** to 8‑K Exhibit & Transcript
**Test:** Open `/company/AAPL`, `/company/MSFT`, `/company/NVDA`, `/company/GOOGL`; verify distinct data.  
**Commit:** `feat: dynamic company page by ticker`

**STEP 11 — Admin Import (End‑to‑End)**
- Route: `/admin/import`
  - Buttons: **Fetch Filings → Parse Guidance → Pull Actuals → Analyze Language → Score GCI**
  - Log each step; show toasts; idempotent execution
**Test:** Import a **new** ticker (not in seeds) and view its company page.  
**Commit:** `feat: admin import pipeline (E2E)`

---

## POLISH

**STEP 12 — QuickChart integration + cache**
- Use `quickchart-js` to produce grouped bars for the last 4 periods. Cache images under `/public/charts/{ticker}-{fy}.png`. Fallback to inline SVG if network fails.
**Test:** Generate charts for 3 tickers; verify instant load.  
**Commit:** `feat: quickchart timelines + cache`

**STEP 13 — Caching & Error UX**
- Disk cache for SEC responses; memoize transcript fetch.
- Skeleton loaders; toast errors; keep last good score in view.
**Test:** Simulate network/429 errors; app stays functional.  
**Commit:** `chore: caching + resilient UX`

**STEP 14 — Demo Seeds + README**
- Seed 5 tickers with pre‑fetched rows.
- Add README with a 2‑minute demo script.
**Test:** Dry‑run the demo from blank DB using Admin Import.  
**Commit:** `docs: demo seeds + instructions`

---

## DEPLOY (Vercel — ask me what’s needed, then automate)

**STEP 15 — Deploy to Vercel (ASK USER, then act)**
- **ASK USER:**  
  1) *Do you want live imports (writes) using Postgres, or a read‑only demo using bundled SQLite?*  
  2) *Paste your Vercel **Project URL** (dashboard) and confirm the project currently shows “Framework Preset: Other”.*  
  3) *If Postgres: Should I create and connect a **Vercel Postgres** database from the Vercel dashboard for you to use?*

- **If user chooses read‑only SQLite (demo path):**
  - Ensure `data/gci.db` is seeded before deploy.  
  - Proceed with build & deploy. (SQLite writes are not supported on Vercel; read‑only is OK.)

- **If user chooses Postgres (live path):**
  - **ASK USER:** Paste `DATABASE_URL` (Vercel Postgres or external).  
  - Update `src/server/db.ts` to use Postgres when `process.env.DATABASE_URL` exists; fallback to SQLite locally.
  - Store `DATABASE_URL` in Vercel Project → Settings → Environment Variables.

- **Fix the “Framework Preset: Other” issue:**
  - **Preferred:** In Vercel Project → Settings → **Build & Development → Framework Preset**, set **Next.js** and redeploy.  
  - **OR** add a `vercel.json` to force the preset:
    ```json
    {
      "$schema": "https://openapi.vercel.sh/vercel.json",
      "framework": "nextjs"
    }
    ```
    Commit and redeploy.

- **Add env var in Vercel:** `SEC_UA` (same value as local).

- **Deploy:**
  - Push to GitHub; Vercel will auto‑detect Next.js and run `next build` (zero‑config).

**Test:** Paste the production URL. Visit `/` and `/company/{AAPL,MSFT,NVDA,GOOGL}` to confirm multi‑company works.  
**Commit:** `chore: deploy to Vercel (framework preset + env + DB strategy)`

> Refs: Next.js on Vercel (zero‑config), Vercel Postgres (connect DB), Project Settings (Framework Preset), `vercel.json` framework override.  

---

## DONE
- Append to `tracking.md`: “MVP complete; ready to demo.”
