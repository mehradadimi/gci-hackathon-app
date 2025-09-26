import { getCompaniesWithPairs, getGuidanceWithActuals, getLatestLanguageMetricsForCompany, upsertScore } from './repo';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function normalizeLR(hedgesPerK: number | null, uncertaintyPerK: number | null): number {
  // Simple inverse normalization to 0–100 (heuristic placeholder)
  const h = hedgesPerK ?? 0;
  const u = uncertaintyPerK ?? 0;
  const raw = h * 0.5 + u * 1.0;
  const scaled = clamp(100 - raw, 0, 100);
  return scaled;
}

export async function computeScores(): Promise<Array<{ ticker: string; fy: number | null; fp: string | null; tra: number; cvp: number; lr: number; gci: number; badge: 'High' | 'Medium' | 'Low' }>> {
  const companies = await getCompaniesWithPairs();
  const rows: Array<{ ticker: string; fy: number | null; fp: string | null; tra: number; cvp: number; lr: number; gci: number; badge: 'High' | 'Medium' | 'Low' }> = [];

  for (const c of companies) {
    const pairs = await getGuidanceWithActuals(c.id);
    // group by period (fy, fp)
    const byPeriod = new Map<string, { fy: number | null; fp: string | null; errors: number[] }>();
    for (const p of pairs) {
      if (p.guided_mid == null || p.actual_value == null || p.guided_mid === 0) continue;
      const key = `${p.fy ?? 'NA'}-${p.fp ?? 'NA'}`;
      const absErrRatio = Math.abs((p.actual_value - p.guided_mid) / p.guided_mid);
      const e = clamp(absErrRatio, 0, 0.5);
      const entry = byPeriod.get(key) || { fy: p.fy, fp: p.fp, errors: [] };
      entry.errors.push(e);
      byPeriod.set(key, entry);
    }
    // last up to 4 periods
    const periodKeys = Array.from(byPeriod.keys()).slice(0, 4);
    const allErrors = periodKeys.flatMap((k) => byPeriod.get(k)!.errors);
    const tra = allErrors.length ? 100 * (1 - allErrors.reduce((a, b) => a + b, 0) / allErrors.length) : 0;
    const cvp = 100 * (1 - Math.min(stddev(allErrors) / 0.1, 1));

    const lm = await getLatestLanguageMetricsForCompany(c.id);
    const lr = normalizeLR(lm?.hedges_per_k ?? null, lm?.uncertainty_per_k ?? null);
    const gci = 0.5 * tra + 0.2 * cvp + 0.3 * lr;
    const badge: 'High' | 'Medium' | 'Low' = gci >= 80 ? 'High' : gci >= 60 ? 'Medium' : 'Low';

    // Report for the latest period in our slice
    const firstKey = periodKeys[0];
    const first = firstKey ? byPeriod.get(firstKey)! : { fy: null, fp: null } as any;
    const row = { ticker: c.ticker, fy: first.fy, fp: first.fp, tra: Math.round(tra), cvp: Math.round(cvp), lr: Math.round(lr), gci: Math.round(gci), badge };
    rows.push(row);

    // Persist score against the most recent period for this company
    const mostRecent = pairs[0];
    if (mostRecent) {
      await upsertScore({
        periodId: mostRecent.period_id,
        tra: row.tra,
        cvp: row.cvp,
        lr: row.lr,
        gci: row.gci,
        badge: row.badge,
        rationale: 'Auto-computed based on guidance vs actuals and language metrics.',
      });
    }
  }

  return rows;
}


