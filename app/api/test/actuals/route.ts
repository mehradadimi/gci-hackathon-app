import { NextResponse } from 'next/server';
import { createCompany, getCompanyByTicker, getActualPresenceForCompany } from '@/src/server/repo';
import { fetchAndStoreActualsForTicker } from '@/src/server/actuals';

export async function GET() {
  // Ensure two tickers with guidance exist (from prior step) and then fetch actuals
  await createCompany({ ticker: 'MSFT', cik: '0000789019', name: 'Microsoft Corporation' });
  await createCompany({ ticker: 'NVDA', cik: '0001045810', name: 'NVIDIA Corporation' });

  await fetchAndStoreActualsForTicker('MSFT');
  await fetchAndStoreActualsForTicker('NVDA');

  const msft = await getCompanyByTicker('MSFT');
  const nvda = await getCompanyByTicker('NVDA');
  const msftPresence = msft ? await getActualPresenceForCompany(msft.id) : [];
  const nvdaPresence = nvda ? await getActualPresenceForCompany(nvda.id) : [];

  return NextResponse.json({ MSFT: msftPresence, NVDA: nvdaPresence });
}


