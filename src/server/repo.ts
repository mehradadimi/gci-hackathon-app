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

export async function getCompanyByTicker(ticker: string): Promise<CompanyRow | undefined> {
  const db = getDb();
  return db.getAsync<CompanyRow>(
    `SELECT id, ticker, cik, name FROM companies WHERE ticker = ?`,
    [ticker.toUpperCase()]
  );
}

export type PeriodRow = {
  id: number;
  company_id: number;
  fy: number | null;
  fp: string | null;
  period_end: string | null;
  source_8k_url: string | null;
  exhibit_991_url: string | null;
  transcript_url: string | null;
};

export async function ensurePeriod(params: {
  companyId: number;
  fy: number | null;
  fp: string | null;
  periodEnd: string | null;
  source8kUrl: string | null;
  exhibit991Url: string | null;
  transcriptUrl?: string | null;
}): Promise<number> {
  const db = getDb();
  const existing = await db.getAsync<PeriodRow>(
    `SELECT id FROM periods WHERE company_id = ? AND IFNULL(fy, -1) = IFNULL(?, -1) AND IFNULL(fp, '') = IFNULL(?, '') AND IFNULL(period_end, '') = IFNULL(?, '')` ,
    [params.companyId, params.fy, params.fp, params.periodEnd]
  );
  if (existing?.id) {
    // Update URLs if missing
    await db.runAsync(
      `UPDATE periods SET source_8k_url = COALESCE(?, source_8k_url), exhibit_991_url = COALESCE(?, exhibit_991_url), transcript_url = COALESCE(?, transcript_url) WHERE id = ?`,
      [params.source8kUrl, params.exhibit991Url, params.transcriptUrl ?? null, existing.id]
    );
    return existing.id;
  }
  await db.runAsync(
    `INSERT INTO periods (company_id, fy, fp, period_end, source_8k_url, exhibit_991_url, transcript_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.companyId,
      params.fy,
      params.fp,
      params.periodEnd,
      params.source8kUrl,
      params.exhibit991Url,
      params.transcriptUrl ?? null,
    ]
  );
  const inserted = await db.getAsync<PeriodRow>(`SELECT last_insert_rowid() as id` as any);
  return (inserted as any).id as number;
}

export async function insertGuidance(params: {
  periodId: number;
  metric: 'revenue' | 'eps_diluted';
  minValue: number | null;
  maxValue: number | null;
  units: 'USD_M' | 'EPS';
  basis: 'GAAP' | 'non-GAAP' | null;
  extractedText: string;
}): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO guidance (period_id, metric, min_value, max_value, units, basis, extracted_text) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.periodId,
      params.metric,
      params.minValue,
      params.maxValue,
      params.units,
      params.basis,
      params.extractedText,
    ]
  );
}


