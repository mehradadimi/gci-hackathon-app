import { NextResponse } from 'next/server';
import { generateRevenueChartForTicker } from '@/src/server/charts';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const tickersParam = url.searchParams.get('tickers') || '';
  const tickers = tickersParam.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  const results: any[] = [];
  for (const t of tickers) {
    const r = await generateRevenueChartForTicker(t);
    results.push({ ticker: t, urlPath: r.urlPath });
  }
  return NextResponse.json({ ok: true, results });
}


