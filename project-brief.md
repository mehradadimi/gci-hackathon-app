# GCI — Guidance Credibility Index (Hackathon Project Brief)

## One-liner
We don’t summarize earnings calls — we **score** how **trustworthy** a company’s guidance is, using “promised vs. delivered” history plus **language-risk** signals from transcripts.

## Problem
Analysts/PMs have limited time to judge if management’s **forward guidance** is reliable. Existing tools summarize content but don’t quantify **credibility** across time.

## Solution
A web app that:
- Extracts **guidance** ranges from 8-K press releases (Exhibit 99.1) and aligns them to periods.  
- Pulls **actual reported** results via SEC **XBRL Company Facts**.  
- Computes a 0–100 **GCI score** from: Track-Record Accuracy (TRA), Consistency/Volatility (CVP), and **Language Risk** (LR) from Q&A transcripts.  
- Shows a **badge** (High/Medium/Low), **mini-timeline** of promised vs delivered, and **red-flag** chips (e.g., heavy hedging).  
- Links directly to the **source filings** and **transcripts** for auditability.

_Data sources:_ SEC EDGAR APIs (Submissions, XBRL), Form 8-K Item 2.02 Exhibit 99.1, and publicly accessible earnings call transcripts. :contentReference[oaicite:3]{index=3}

## Users
- **PMs/CIOs**: quick trust screen before sizing positions.  
- **Sell-/Buy-side analysts**: faster triage of coverage lists.  
- **IR/Corp Dev**: benchmark messaging credibility over time.

## Success Criteria (demo)
- For 3–5 tickers, app shows GCI + rationale, timeline, LR panel, and one-click **Open 8-K** / **Open transcript** links.  
- Simple, beautiful UI; sub-2s response on cached data.  
- All numbers trace back to primary sources.

## Non-Functional
- **Speed-first** (cache results locally).  
- **Explainable** (show formula + sources).  
- **Deterministic core** (regex + numeric math); AI used for short rationale only.  
- **Privacy**: public data only.

## Constraints
- 3-hour hackathon build; minimize scope: focus on **Revenue** and **EPS (diluted)**, last 4 guided periods.

## Risks & Mitigation
- **Parsing variance** → start with 3–5 well-formatted large caps; robust regex fallbacks.  
- **Transcript availability** → fallback to prepared remarks if Q&A missing.  
- **Rate limits** → SEC user-agent + cache.

## Judge Pitch
“GCI turns hours of noisy reading into a **transparent credibility score** backed by filings, not vibes. It’s a new KPI the desk actually wants.”
