import { NextResponse } from 'next/server';
import { getCompanySubmissions, getCompanyConcept } from '@/src/server/sec';

export async function GET() {
  const ciks = ['0000320193', '0000789019']; // AAPL, MSFT
  const submissions = await Promise.all(ciks.map((cik) => getCompanySubmissions(cik)));
  const concepts = await Promise.all(ciks.map((cik) => getCompanyConcept(cik, 'Revenues')));

  const out = {
    submissions: submissions.map((s) => ({
      hasFilings: !!s.filings,
      recentCount: s.filings?.recent?.accessionNumber?.length ?? 0,
    })),
    concepts: concepts.map((c) => ({
      hasUnits: !!c.units,
      tag: c.tag,
      unitKeys: c.units ? Object.keys(c.units) : [],
    })),
  };
  return NextResponse.json(out);
}


