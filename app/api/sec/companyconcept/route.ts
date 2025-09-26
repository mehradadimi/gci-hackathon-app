import { NextResponse } from 'next/server';
import { getCIKByTicker } from '@/src/server/cik';
import { getCompanyConcept } from '@/src/server/sec';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
  const tag = url.searchParams.get('tag') || '';
  if (!ticker || !tag) return NextResponse.json({ error: 'ticker and tag required' }, { status: 400 });
  try {
    const cik = await getCIKByTicker(ticker);
    const json = await getCompanyConcept(cik, tag);
    return NextResponse.json({ cik, tag, json });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


