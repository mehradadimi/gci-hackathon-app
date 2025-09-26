import { NextResponse } from 'next/server';
import { fetchAndStoreActualsForTicker } from '@/src/server/actuals';

type Body = { tickers?: string[] };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get('tickers');
  const tickers = (body.tickers || tickersParam?.split(',') || []).map((t) => t.trim().toUpperCase()).filter(Boolean);
  const logs: any[] = [];
  for (const t of tickers) {
    try {
      await fetchAndStoreActualsForTicker(t);
      logs.push({ ticker: t, ok: true });
    } catch (e: any) {
      logs.push({ ticker: t, ok: false, error: String(e?.message || e) });
    }
  }
  return NextResponse.json({ ok: true, logs });
}


