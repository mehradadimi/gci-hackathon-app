import { getDb } from './db';

export type CompanyRow = {
  id: number;
  ticker: string;
  cik: string;
  name: string;
};

export async function createCompany(params: { ticker: string; cik: string; name: string }): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO companies (ticker, cik, name) VALUES (?, ?, ?)`,
    [params.ticker.toUpperCase(), params.cik, params.name]
  );
}

export async function getCompanies(): Promise<CompanyRow[]> {
  const db = getDb();
  return db.allAsync<CompanyRow>(`SELECT id, ticker, cik, name FROM companies ORDER BY ticker ASC`);
}


