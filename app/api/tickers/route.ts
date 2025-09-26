import { NextResponse } from 'next/server';
import { loadCompanyTickers } from '@/src/server/cik';

export async function GET() {
  const map = await loadCompanyTickers();
  const out = Array.from(map.entries()).slice(0, 500).map(([ticker, info]) => ({ ticker, name: info.name }));
  return NextResponse.json(out);
}


