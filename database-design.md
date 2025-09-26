# GCI — Database / Data Model (MVP)

> Use SQLite (file: `gci.db`) for speed. Keep tables minimal and denormalized where helpful.

## Entities

### companies
- id (PK, int)
- ticker (text, unique, idx)
- cik (text, 10-digit, zero-padded)
- name (text)

### periods
- id (PK, int)
- company_id (FK -> companies.id)
- fy (int)         # fiscal year from XBRL (e.g., 2025)
- fp (text)        # fiscal period: Q1|Q2|Q3|Q4|FY
- period_end (date)
- source_8k_url (text)       # filing detail page
- exhibit_991_url (text)     # direct Exhibit 99.1 if available
- transcript_url (text)      # Motley Fool or other source

### guidance
- id (PK, int)
- period_id (FK -> periods.id)
- metric (text)    # 'revenue' | 'eps_diluted'
- min_value (real) # normalized dollars or EPS
- max_value (real)
- units (text)     # USD_M | USD_B | EPS
- basis (text)     # GAAP | non-GAAP
- extracted_text (text)  # raw sentence for audit

### actuals
- id (PK, int)
- period_id (FK)
- metric (text)          # 'revenue' | 'eps_diluted'
- actual_value (real)
- units (text)           # must match guidance units after normalization
- xbrl_tag (text)        # e.g., us-gaap:Revenues, us-gaap:EarningsPerShareDiluted
- xbrl_api_url (text)    # provenance

### language_metrics
- id (PK, int)
- period_id (FK)
- words_total (int)
- hedges_per_k (real)        # may, might, approximately, around, etc.
- negations_per_k (real)     # not, no, never
- uncertainty_per_k (real)   # cautious, limited visibility, headwinds, etc.
- vague_per_k (real)         # somewhat, kind of, relatively
- source_section (text)      # 'Q&A' | 'Prepared'

### scores
- id (PK, int)
- period_id (FK)
- tra (real)    # 0-100
- cvp (real)    # 0-100
- lr (real)     # 0-100
- gci (real)    # 0-100
- badge (text)  # High|Medium|Low
- rationale (text)

## Notes
- Unit normalization: map `$5.2–$5.4B` → 5200–5400 USD_M; EPS stays numeric.
- Period alignment uses XBRL `fy`, `fp`, `end`. :contentReference[oaicite:4]{index=4}
