import { getCompanyConcept } from './sec';
import { getCompanyByTicker, getGuidancePairsForCompany, upsertActual, getDeliveredSeriesForCompany } from './repo';

function pickAlignedValue(concept: any, fy: number | null, fp: string | null): number | null {
  if (!concept?.units) return null;
  const series = concept.units['USD'] || concept.units['USD/shares'] || [];
  // Try to match by fy/fp
  for (const v of series) {
    if (fy != null && v.fy !== fy) continue;
    if (fp != null && v.fp?.toUpperCase() !== fp?.toUpperCase()) continue;
    if (typeof v.val === 'number') return v.val as number;
  }
  // Fallback: latest number
  const last = [...series].reverse().find((v: any) => typeof v.val === 'number');
  return last ? (last.val as number) : null;
}

export async function fetchAndStoreActualsForTicker(ticker: string): Promise<void> {
  const company = await getCompanyByTicker(ticker);
  if (!company) throw new Error(`Unknown company: ${ticker}`);

  const pairs = await getGuidancePairsForCompany(company.id);
  // Always ensure we have recent delivered revenue actuals, regardless of guidance presence
  try {
    const conceptRev = await getCompanyConcept(company.cik, 'Revenues');
    const seriesRev = (conceptRev?.units?.USD || []) as any[];
    for (const v of seriesRev.slice(-4).reverse()) {
      const fy = typeof v.fy === 'number' ? v.fy : null;
      const fp = typeof v.fp === 'string' ? v.fp.toUpperCase() : null;
      const periodId = await ensurePeriodSafe(company.id, fy, fp);
      await upsertActual({
        periodId,
        metric: 'revenue',
        actualValue: v.val != null ? Math.round((Number(v.val) / 1_000_000) * 100) / 100 : null,
        units: 'USD_M',
        xbrlTag: 'us-gaap:Revenues',
        xbrlApiUrl: `https://data.sec.gov/api/xbrl/companyconcept/CIK${company.cik}/us-gaap/Revenues.json`,
      });
    }
  } catch (e) {
    // ignore; keep going to fill guided-specific metrics
  }

  for (const p of pairs) {
    if (p.metric === 'revenue') {
      const concept = await getCompanyConcept(company.cik, 'Revenues');
      const val = pickAlignedValue(concept, p.fy, p.fp);
      await upsertActual({
        periodId: p.period_id,
        metric: 'revenue',
        actualValue: val != null ? Math.round((val / 1_000_000) * 100) / 100 : null,
        units: 'USD_M',
        xbrlTag: 'us-gaap:Revenues',
        xbrlApiUrl: `https://data.sec.gov/api/xbrl/companyconcept/CIK${company.cik}/us-gaap/Revenues.json`,
      });
    } else if (p.metric === 'eps_diluted') {
      const concept = await getCompanyConcept(company.cik, 'EarningsPerShareDiluted');
      const val = pickAlignedValue(concept, p.fy, p.fp);
      await upsertActual({
        periodId: p.period_id,
        metric: 'eps_diluted',
        actualValue: val,
        units: 'EPS',
        xbrlTag: 'us-gaap:EarningsPerShareDiluted',
        xbrlApiUrl: `https://data.sec.gov/api/xbrl/companyconcept/CIK${company.cik}/us-gaap/EarningsPerShareDiluted.json`,
      });
    }
  }
}

async function ensurePeriodSafe(companyId: number, fy: number | null, fp: string | null): Promise<number> {
  // lightweight helper to ensure a period row exists without links
  const { getDb } = await import('./db');
  const db = getDb();
  const existing = await db.getAsync<{ id: number }>(
    `SELECT id FROM periods WHERE company_id = ? AND IFNULL(fy, -1) = IFNULL(?, -1) AND IFNULL(fp, '') = IFNULL(?, '')`,
    [companyId, fy, fp]
  );
  if (existing?.id) return existing.id;
  await db.runAsync(
    `INSERT INTO periods (company_id, fy, fp) VALUES (?, ?, ?)`,
    [companyId, fy, fp]
  );
  const row = await db.getAsync<{ id: number }>(`SELECT last_insert_rowid() as id` as any);
  return (row as any).id as number;
}


