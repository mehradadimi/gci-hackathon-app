import { NextResponse } from 'next/server';
import { computeScores } from '@/src/server/score';
import { createCompany } from '@/src/server/repo';

export async function GET() {
  // Ensure demo companies exist
  await createCompany({ ticker: 'MSFT', cik: '0000789019', name: 'Microsoft Corporation' });
  await createCompany({ ticker: 'NVDA', cik: '0001045810', name: 'NVIDIA Corporation' });
  await createCompany({ ticker: 'GOOGL', cik: '0001652044', name: 'Alphabet Inc. (Class A)' });

  const rows = await computeScores();
  return NextResponse.json(rows);
}


