import { NextResponse } from 'next/server';
import { getCIKByTicker } from '@/src/server/cik';

export async function GET() {
  const tickers = ['AAPL', 'MSFT', 'NVDA', 'GOOGL'];
  const out: Record<string, string> = {};
  for (const t of tickers) {
    out[t] = await getCIKByTicker(t);
  }
  return NextResponse.json(out);
}


