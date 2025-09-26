# GCI — UI Style Guide (Tailwind + shadcn/ui)

## Visual Principles
- Minimal, executive, legible at a glance.
- Clear color semantics for credibility: **High (emerald)**, **Medium (amber)**, **Low (rose)**.
- Strong information hierarchy: Badge + Rationale → Timeline → Language → Breakdown → Sources.

## Layout
- **Home**: split hero with CTA and ticker search; recent companies grid below.
- **Company**: 2‑column above `md` breakpoint; cards stack on mobile; skeleton loaders for each card.

## Components
### `<GciBadge score={number} />`
- Map to variants:
  - High (≥80): `bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`
  - Medium (60–79): `bg-amber-50 text-amber-800 ring-1 ring-amber-200`
  - Low (<60): `bg-rose-50 text-rose-700 ring-1 ring-rose-200`
- Add `aria-label="Credibility: High|Medium|Low"`

### `<MetricChips flags={string[]} />`
- Rounded chips with subtle dot `before:size-2 before:rounded-full before:mr-2`

### `<TimelineChart pairs={[{label, promised, delivered}, ...]} />`
- Use **QuickChart** (Chart.js) grouped bars; cache PNG under `/public/charts`.

### `<SourceLinks filingUrl transcriptUrl />`
- Buttons: “Open 8‑K”, “Open Transcript”. Underline on hover.

## Typography
- Headline: `text-2xl md:text-3xl font-semibold`
- Body: `text-sm md:text-base text-neutral-700`

## Accessibility
- Use `aria-live="polite"` for async status; button labels have `aria-label`.
- Keyboard navigable inputs and cards.

## Empty/Loading/Error States
- Skeletons for timeline and tables.
- Toasts for transient errors; inline message for persistent issues.
