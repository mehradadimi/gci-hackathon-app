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
  segment?: string | null;
  sourceUrl?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.runAsync(`ALTER TABLE guidance ADD COLUMN source_url TEXT`).catch(() => undefined);
  await db.runAsync(`ALTER TABLE guidance ADD COLUMN segment TEXT`).catch(() => undefined);
  await db.runAsync(
    `INSERT INTO guidance (period_id, metric, min_value, max_value, units, basis, extracted_text, segment, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.periodId,
      params.metric,
      params.minValue,
      params.maxValue,
      params.units,
      params.basis,
      params.extractedText,
      params.segment ?? null,
      params.sourceUrl ?? null,
    ]
  );
}

export type GuidedPairRow = {
  period_id: number;
  fy: number | null;
  fp: string | null;
  metric: 'revenue' | 'eps_diluted';
};

export async function getGuidancePairsForCompany(companyId: number): Promise<GuidedPairRow[]> {
  const db = getDb();
  return db.allAsync<GuidedPairRow>(
    `SELECT p.id as period_id, p.fy as fy, p.fp as fp, g.metric as metric
     FROM periods p
     JOIN guidance g ON g.period_id = p.id
     WHERE p.company_id = ?
     ORDER BY p.fy DESC, p.fp DESC`,
    [companyId]
  );
}

export async function upsertActual(params: {
  periodId: number;
  metric: 'revenue' | 'eps_diluted';
  actualValue: number | null;
  units: 'USD_M' | 'EPS';
  xbrlTag: string;
  xbrlApiUrl: string;
}): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM actuals WHERE period_id = ? AND metric = ?`, [params.periodId, params.metric]);
  await db.runAsync(
    `INSERT INTO actuals (period_id, metric, actual_value, units, xbrl_tag, xbrl_api_url) VALUES (?, ?, ?, ?, ?, ?)`,
    [params.periodId, params.metric, params.actualValue, params.units, params.xbrlTag, params.xbrlApiUrl]
  );
}

export type ActualPresenceRow = {
  period_id: number;
  metric: 'revenue' | 'eps_diluted';
  has_actual: number; // 0|1
};

export async function getActualPresenceForCompany(companyId: number): Promise<ActualPresenceRow[]> {
  const db = getDb();
  return db.allAsync<ActualPresenceRow>(
    `SELECT p.id as period_id, g.metric as metric,
            EXISTS(SELECT 1 FROM actuals a WHERE a.period_id = p.id AND a.metric = g.metric) as has_actual
     FROM periods p
     JOIN guidance g ON g.period_id = p.id
     WHERE p.company_id = ?
     ORDER BY p.fy DESC, p.fp DESC`,
    [companyId]
  );
}

export async function insertExhibit(params: {
  periodId: number;
  exNo: string;
  url: string;
  contentType: string;
  fileName: string;
  textCachePath: string | null;
  hintGuidanceOnCall?: boolean;
}): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS exhibits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      ex_no TEXT,
      url TEXT,
      content_type TEXT,
      file_name TEXT,
      text_cache_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (period_id) REFERENCES periods(id)
    )`
  );
  await db.runAsync(
    `INSERT INTO exhibits (period_id, ex_no, url, content_type, file_name, text_cache_path, hint_guidance_on_call) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [params.periodId, params.exNo, params.url, params.contentType, params.fileName, params.textCachePath, params.hintGuidanceOnCall ? 1 : 0]
  );
}

export async function insertLanguageMetrics(params: {
  periodId: number;
  wordsTotal: number;
  hedgesPerK: number;
  negationsPerK: number;
  uncertaintyPerK: number;
  vaguePerK: number;
  sourceSection: 'Q&A' | 'Prepared';
}): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO language_metrics (period_id, words_total, hedges_per_k, negations_per_k, uncertainty_per_k, vague_per_k, source_section)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.periodId,
      params.wordsTotal,
      params.hedgesPerK,
      params.negationsPerK,
      params.uncertaintyPerK,
      params.vaguePerK,
      params.sourceSection,
    ]
  );
}

export type GuidanceActualRow = {
  period_id: number;
  fy: number | null;
  fp: string | null;
  metric: 'revenue' | 'eps_diluted';
  guided_mid: number | null;
  actual_value: number | null;
};

export async function getGuidanceWithActuals(companyId: number): Promise<GuidanceActualRow[]> {
  const db = getDb();
  return db.allAsync<GuidanceActualRow>(
    `SELECT p.id as period_id, p.fy as fy, p.fp as fp, g.metric as metric,
            (g.min_value + g.max_value) / 2.0 as guided_mid,
            a.actual_value as actual_value
     FROM periods p
     JOIN guidance g ON g.period_id = p.id
     JOIN actuals a ON a.period_id = p.id AND a.metric = g.metric
     WHERE p.company_id = ?
     ORDER BY COALESCE(p.fy, 0) DESC, CASE UPPER(COALESCE(p.fp, '')) WHEN 'FY' THEN 5 WHEN 'Q4' THEN 4 WHEN 'Q3' THEN 3 WHEN 'Q2' THEN 2 WHEN 'Q1' THEN 1 ELSE 0 END DESC`,
    [companyId]
  );
}

export type CompanyBasic = { id: number; ticker: string };

export async function getCompaniesWithPairs(): Promise<CompanyBasic[]> {
  const db = getDb();
  return db.allAsync<CompanyBasic>(
    `SELECT DISTINCT c.id, c.ticker
     FROM companies c
     JOIN periods p ON p.company_id = c.id
     JOIN guidance g ON g.period_id = p.id
     JOIN actuals a ON a.period_id = p.id AND a.metric = g.metric
     ORDER BY c.ticker ASC`
  );
}

export type LanguageMetricsRow = {
  period_id: number;
  hedges_per_k: number | null;
  uncertainty_per_k: number | null;
};

export async function getLatestLanguageMetricsForCompany(companyId: number): Promise<LanguageMetricsRow | undefined> {
  const db = getDb();
  return db.getAsync<LanguageMetricsRow>(
    `SELECT lm.period_id, lm.hedges_per_k, lm.uncertainty_per_k
     FROM language_metrics lm
     JOIN periods p ON p.id = lm.period_id
     WHERE p.company_id = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [companyId]
  );
}

export type ScoreRow = {
  period_id: number;
  tra: number | null;
  cvp: number | null;
  lr: number | null;
  gci: number | null;
  badge: 'High' | 'Medium' | 'Low' | null;
  rationale: string | null;
};

export async function getLatestScoreForCompany(companyId: number): Promise<ScoreRow | undefined> {
  const db = getDb();
  return db.getAsync<ScoreRow>(
    `SELECT s.period_id, s.tra, s.cvp, s.lr, s.gci, s.badge, s.rationale
     FROM scores s
     JOIN periods p ON p.id = s.period_id
     WHERE p.company_id = ?
     ORDER BY s.id DESC
     LIMIT 1`,
    [companyId]
  );
}

export async function getRevenuePairsForCompany(companyId: number, limit: number = 4): Promise<Array<{ label: string; promised: number; delivered: number }>> {
  const db = getDb();
  const rows = await db.allAsync<{
    fy: number | null;
    fp: string | null;
    guided_mid: number | null;
    actual_value: number | null;
  }>(
    `SELECT p.fy, p.fp, (g.min_value + g.max_value)/2.0 AS guided_mid, a.actual_value
     FROM periods p
     JOIN guidance g ON g.period_id = p.id AND g.metric = 'revenue'
     LEFT JOIN actuals a ON a.period_id = p.id AND a.metric = 'revenue'
     WHERE p.company_id = ?
     ORDER BY COALESCE(p.fy, 0) DESC, CASE UPPER(COALESCE(p.fp, '')) WHEN 'FY' THEN 5 WHEN 'Q4' THEN 4 WHEN 'Q3' THEN 3 WHEN 'Q2' THEN 2 WHEN 'Q1' THEN 1 ELSE 0 END DESC
     LIMIT ?`,
    [companyId, limit]
  );
  return rows
    .filter((r) => r.guided_mid != null && r.actual_value != null)
    .map((r) => ({ label: `${r.fy ?? ''}${r.fp ? ' ' + r.fp : ''}`.trim(), promised: Number(r.guided_mid), delivered: Number(r.actual_value) }));
}

export async function getRevenuePairsForCompanyDetailed(companyId: number, limit: number = 4): Promise<Array<{ fy: number | null; fp: string | null; label: string; promised: number; delivered: number }>> {
  const db = getDb();
  const rows = await db.allAsync<{
    fy: number | null;
    fp: string | null;
    guided_mid: number | null;
    actual_value: number | null;
  }>(
    `SELECT p.fy, p.fp, (g.min_value + g.max_value)/2.0 AS guided_mid, a.actual_value
     FROM periods p
     JOIN guidance g ON g.period_id = p.id AND g.metric = 'revenue'
     LEFT JOIN actuals a ON a.period_id = p.id AND a.metric = 'revenue'
     WHERE p.company_id = ?
     ORDER BY COALESCE(p.fy, 0) DESC, CASE UPPER(COALESCE(p.fp, '')) WHEN 'FY' THEN 5 WHEN 'Q4' THEN 4 WHEN 'Q3' THEN 3 WHEN 'Q2' THEN 2 WHEN 'Q1' THEN 1 ELSE 0 END DESC
     LIMIT ?`,
    [companyId, limit]
  );
  return rows
    .filter((r) => r.guided_mid != null && r.actual_value != null)
    .map((r) => ({ fy: r.fy, fp: r.fp, label: `${r.fy ?? ''}${r.fp ? ' ' + r.fp : ''}`.trim(), promised: Number(r.guided_mid), delivered: Number(r.actual_value) }));
}

export async function getLatestPeriodLinks(companyId: number): Promise<{ source_8k_url: string | null; exhibit_991_url: string | null; transcript_url: string | null } | undefined> {
  const db = getDb();
  return db.getAsync<{ source_8k_url: string | null; exhibit_991_url: string | null; transcript_url: string | null }>(
    `SELECT p.source_8k_url, p.exhibit_991_url, p.transcript_url
     FROM periods p
     LEFT JOIN guidance g ON g.period_id = p.id
     WHERE p.company_id = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [companyId]
  );
}

export async function upsertScore(params: {
  periodId: number;
  tra: number;
  cvp: number;
  lr: number;
  gci: number;
  badge: 'High' | 'Medium' | 'Low';
  rationale: string;
}): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM scores WHERE period_id = ?`, [params.periodId]);
  await db.runAsync(
    `INSERT INTO scores (period_id, tra, cvp, lr, gci, badge, rationale) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.periodId,
      params.tra,
      params.cvp,
      params.lr,
      params.gci,
      params.badge,
      params.rationale,
    ]
  );
}


