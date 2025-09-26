import { getCompanyConcept } from './sec';
import { getCompanyByTicker, getGuidancePairsForCompany, upsertActual } from './repo';

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


