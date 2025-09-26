import { NextResponse } from 'next/server';
import { createCompany } from '@/src/server/repo';
import { extractGuidanceFromLatest8K } from '@/src/server/guidance';

export async function GET() {
  try {
    // Two non-AAPL tickers for the test (e.g., MSFT and NVDA)
    await createCompany({ ticker: 'MSFT', cik: '0000789019', name: 'Microsoft Corporation' });
    await createCompany({ ticker: 'NVDA', cik: '0001045810', name: 'NVIDIA Corporation' });

    const msft = await extractGuidanceFromLatest8K('MSFT');
    const nvda = await extractGuidanceFromLatest8K('NVDA');

    return NextResponse.json({ MSFT: msft, NVDA: nvda });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}


