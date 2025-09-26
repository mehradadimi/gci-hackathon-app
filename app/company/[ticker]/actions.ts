'use server';
import { getCIKByTicker } from '@/src/server/cik';
import { getCompanyConcept } from '@/src/server/sec';
import { getCompanyByTicker } from '@/src/server/repo';
import { fetchAndStoreActualsForTicker } from '@/src/server/actuals';

export async function ensureCompanyBasics(ticker: string) {
  const t = ticker.toUpperCase();
  const cik = await getCIKByTicker(t);
  const company = await getCompanyByTicker(t);
  if (!company) {
    const { createCompany } = await import('@/src/server/repo');
    await createCompany({ ticker: t, cik, name: t });
  }
  return cik;
}

export async function warmActualsFromSEC(ticker: string) {
  // Fetch Revenues concept and persist delivered-only actuals if needed
  await fetchAndStoreActualsForTicker(ticker.toUpperCase());
}


