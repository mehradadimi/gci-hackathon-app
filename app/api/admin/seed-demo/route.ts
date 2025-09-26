import { NextResponse } from 'next/server';

export async function POST() {
  const tickers = ['AAPL','MSFT','NVDA','GOOGL','COST'];
  const post = (url: string, list: string[]) => fetch(`${url}?tickers=${encodeURIComponent(list.join(','))}`, { method: 'POST' });
  await post('/api/admin/import/fetch-filings', tickers);
  await post('/api/admin/import/parse-guidance', tickers);
  await post('/api/admin/import/pull-actuals', tickers);
  await post('/api/admin/import/analyze-language', tickers);
  const res = await fetch('/api/admin/import/score-gci', { method: 'POST' });
  const rows = await res.json();
  return NextResponse.json({ ok: true, rows });
}


