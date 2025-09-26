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
