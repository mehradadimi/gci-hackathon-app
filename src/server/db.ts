import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export type SqliteDatabase = sqlite3.Database & {
  runAsync: (sql: string, params?: any[]) => Promise<void>;
  getAsync: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
  allAsync: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
};

let dbInstance: SqliteDatabase | null = null;

function ensureDataDir(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

export function getDb(): SqliteDatabase {
  if (dbInstance) return dbInstance;

  ensureDataDir();
  const dbPath = path.join(process.cwd(), 'data', 'gci.db');
  const rawDb = new sqlite3.Database(dbPath);

  // Promisified helpers
  const runAsync = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
      rawDb.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve();
      });
    });
  const getAsync = <T = any>(sql: string, params: any[] = []) =>
    new Promise<T | undefined>((resolve, reject) => {
      rawDb.get(sql, params, function (err, row) {
        if (err) return reject(err);
        resolve(row as T | undefined);
      });
    });
  const allAsync = <T = any>(sql: string, params: any[] = []) =>
    new Promise<T[]>((resolve, reject) => {
      rawDb.all(sql, params, function (err, rows) {
        if (err) return reject(err);
        resolve(rows as T[]);
      });
    });

  dbInstance = Object.assign(rawDb, { runAsync, getAsync, allAsync });

  migrate(dbInstance).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('DB migration failed:', err);
  });

  return dbInstance;
}

async function migrate(db: SqliteDatabase) {
  // Companies
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL UNIQUE,
      cik TEXT NOT NULL,
      name TEXT NOT NULL
    )`
  );

  // Periods
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      fy INTEGER,
      fp TEXT,
      period_end TEXT,
      source_8k_url TEXT,
      exhibit_991_url TEXT,
      transcript_url TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )`
  );

  // Guidance
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS guidance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      metric TEXT NOT NULL,
      min_value REAL,
      max_value REAL,
      units TEXT,
      basis TEXT,
      extracted_text TEXT,
      FOREIGN KEY (period_id) REFERENCES periods(id)
    )`
  );

  // Actuals
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS actuals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      metric TEXT NOT NULL,
      actual_value REAL,
      units TEXT,
      xbrl_tag TEXT,
      xbrl_api_url TEXT,
      FOREIGN KEY (period_id) REFERENCES periods(id)
    )`
  );

  // Language metrics
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS language_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      words_total INTEGER,
      hedges_per_k REAL,
      negations_per_k REAL,
      uncertainty_per_k REAL,
      vague_per_k REAL,
      source_section TEXT,
      FOREIGN KEY (period_id) REFERENCES periods(id)
    )`
  );

  // Scores
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      tra REAL,
      cvp REAL,
      lr REAL,
      gci REAL,
      badge TEXT,
      rationale TEXT,
      FOREIGN KEY (period_id) REFERENCES periods(id)
    )`
  );

  // Helpful index
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_companies_ticker ON companies(ticker)`);

  // Exhibits metadata for auditability
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS exhibits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      ex_no TEXT,
      url TEXT,
      content_type TEXT,
      file_name TEXT,
      text_cache_path TEXT,
      hint_guidance_on_call INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (period_id) REFERENCES periods(id)
    )`
  );
  // Backfill column if table existed earlier
  try {
    await db.runAsync(`ALTER TABLE exhibits ADD COLUMN hint_guidance_on_call INTEGER`);
  } catch (e) {
    // ignore if exists
  }
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_exhibits_period ON exhibits(period_id)`);
}


