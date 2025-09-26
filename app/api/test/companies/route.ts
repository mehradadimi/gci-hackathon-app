import { NextResponse } from 'next/server';
import { createCompany, getCompanies } from '@/src/server/repo';

export async function GET() {
  const seeds = [
    { ticker: 'AAPL', cik: '0000320193', name: 'Apple Inc.' },
    { ticker: 'MSFT', cik: '0000789019', name: 'Microsoft Corporation' },
    { ticker: 'NVDA', cik: '0001045810', name: 'NVIDIA Corporation' },
    { ticker: 'GOOGL', cik: '0001652044', name: 'Alphabet Inc. (Class A)' },
  ];

  for (const s of seeds) {
    await createCompany(s);
  }

  const rows = await getCompanies();
  return NextResponse.json(rows);
}


