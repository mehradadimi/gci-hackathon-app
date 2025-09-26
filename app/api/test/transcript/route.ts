import { NextResponse } from 'next/server';
import { analyzeAndStoreLanguageMetrics } from '@/src/server/transcript';
import { createCompany } from '@/src/server/repo';

export async function GET() {
  await createCompany({ ticker: 'MSFT', cik: '0000789019', name: 'Microsoft Corporation' });
  await createCompany({ ticker: 'NVDA', cik: '0001045810', name: 'NVIDIA Corporation' });

  const msft = await analyzeAndStoreLanguageMetrics('MSFT');
  const nvda = await analyzeAndStoreLanguageMetrics('NVDA');

  return NextResponse.json({ MSFT: msft, NVDA: nvda });
}


