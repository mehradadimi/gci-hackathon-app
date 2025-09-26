import { NextResponse } from 'next/server';
import { createCompany } from '@/src/server/repo';
import { getCIKByTicker } from '@/src/server/cik';
import { getCompanySubmissions } from '@/src/server/sec';

type Body = { tickers?: string[] };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get('tickers');
  const tickers = (body.tickers || tickersParam?.split(',') || []).map((t) => t.trim().toUpperCase()).filter(Boolean);
  const logs: any[] = [];
  for (const t of tickers) {
    try {
      const cik = await getCIKByTicker(t);
      await createCompany({ ticker: t, cik, name: t });
      const subs = await getCompanySubmissions(cik);
      logs.push({ ticker: t, cik, ok: true, recentKeys: Object.keys(subs?.filings?.recent || {}).slice(0, 3) });
    } catch (e: any) {
      logs.push({ ticker: t, ok: false, error: String(e?.message || e) });
    }
  }
  return NextResponse.json({ ok: true, logs });
}


