import { NextResponse } from 'next/server';
import { loadCompanyTickers, getCIKByTicker } from '@/src/server/cik';
import { fetchSecJson, getCompanyConcept, getCompanySubmissions } from '@/src/server/sec';
import { extractGuidanceFromLatest8K, debugScanExhibits, extractGuidanceIssuerAware } from '@/src/server/guidance';
import { fetchAndStoreActualsForTicker } from '@/src/server/actuals';
import { getDb } from '@/src/server/db';

export async function GET() {
  const logs: any[] = [];

  // A. Env
  logs.push({ A_env_SEC_UA: process.env.SEC_UA || null });

  // B. Ticker→CIK
  await loadCompanyTickers();
  const tickers = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'COST'];
  const cikMap: Record<string, string> = {};
  for (const t of tickers) {
    try { cikMap[t] = await getCIKByTicker(t); } catch (e) { cikMap[t] = 'NOT_FOUND'; }
  }
  logs.push({ B_ciks: cikMap });

  // C. SEC API shape checks for two non-AAPL
  const testTickers = ['MSFT', 'NVDA'];
  const secChecks: any[] = [];
  for (const t of testTickers) {
    const cik = cikMap[t];
    const subUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const sub = await fetchSecJson(subUrl);
    const rev = await fetchSecJson(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/Revenues.json`);
    const eps = await fetchSecJson(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/EarningsPerShareDiluted.json`);
    secChecks.push({ t, submissions: { url: sub.url, status: sub.status, keys: Object.keys(sub.json).slice(0, 2) }, revenues: { url: rev.url, status: rev.status, keys: Object.keys(rev.json).slice(0, 2) }, eps: { url: eps.url, status: eps.status, keys: Object.keys(eps.json).slice(0, 2) } });
  }
  logs.push({ C_sec_checks: secChecks });

  // D. Guidance parser (show exhibits meta by reading exhibits table)
  const guidanceOut: any = {};
  for (const t of testTickers) {
    const res = await extractGuidanceIssuerAware(t);
    guidanceOut[t] = res.length ? res : [{ result: 'NO_GUIDANCE_FOUND' }];
  }
  logs.push({ D_guidance: guidanceOut });

  // D2. Exhibit scans and snippets for tuning
  const exhibitsScan: any = {};
  for (const t of testTickers) {
    exhibitsScan[t] = await debugScanExhibits(t);
  }
  logs.push({ D_exhibits_scan: exhibitsScan });

  // E. Actuals alignment
  for (const t of testTickers) {
    await fetchAndStoreActualsForTicker(t);
  }
  logs.push({ E_actuals: 'done' });

  // G. DB Proof queries
  const db = getDb();
  const q = async (sql: string) => new Promise<any[]>((resolve, reject) => db.all(sql, (e, rows) => e ? reject(e) : resolve(rows as any[])));
  const companies = await q(`SELECT ticker, COUNT(*) AS n FROM companies GROUP BY 1 ORDER BY 1`);
  const periods = await q(`SELECT c.ticker, COUNT(*) AS periods FROM periods p JOIN companies c ON c.id=p.company_id GROUP BY 1 ORDER BY 1`);
  const guidance = await q(`SELECT c.ticker, COUNT(*) AS guidance_rows FROM guidance g JOIN periods p ON p.id=g.period_id JOIN companies c ON c.id=p.company_id GROUP BY 1 ORDER BY 1`);
  const actuals = await q(`SELECT c.ticker, COUNT(*) AS actuals_rows FROM actuals a JOIN periods p ON p.id=a.period_id JOIN companies c ON c.id=p.company_id GROUP BY 1 ORDER BY 1`);
  const scores = await q(`SELECT c.ticker, COUNT(*) AS scores_rows FROM scores s JOIN periods p ON p.id=s.period_id JOIN companies c ON c.id=p.company_id GROUP BY 1 ORDER BY 1`);
  const newestGuidance = await q(`SELECT c.ticker, p.fy, p.fp, g.metric, g.min_value as min, g.max_value as max, g.units FROM guidance g JOIN periods p ON p.id=g.period_id JOIN companies c ON c.id=p.company_id ORDER BY g.id DESC LIMIT 3`);
  const newestActuals = await q(`SELECT c.ticker, p.fy, p.fp, a.metric, a.actual_value as value, a.units FROM actuals a JOIN periods p ON p.id=a.period_id JOIN companies c ON c.id=p.company_id ORDER BY a.id DESC LIMIT 3`);
  const newestExhibits = await q(`SELECT e.period_id, e.ex_no, e.url, e.content_type, e.file_name, e.hint_guidance_on_call FROM exhibits e ORDER BY e.id DESC LIMIT 6`);
  logs.push({ G_db: { companies, periods, guidance, actuals, scores, newestGuidance, newestActuals, newestExhibits } });

  return NextResponse.json({ ok: true, logs });
}


