import fs from 'fs';
import path from 'path';

const SEC_COMPANY_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';

export type TickerInfo = {
  cik10: string;
  name: string;
};

function getCachePath(): string {
  const cacheDir = path.join(process.cwd(), '.cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  return path.join(cacheDir, 'company_tickers.json');
}

function isStale(filePath: string, maxAgeDays: number): boolean {
  if (!fs.existsSync(filePath)) return true;
  const stat = fs.statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

function toCik10(numericCik: number | string): string {
  const s = String(numericCik);
  return s.padStart(10, '0');
}

export async function downloadCompanyTickers(force = false): Promise<void> {
  const filePath = getCachePath();
  if (!force && !isStale(filePath, 7)) return;

  const resp = await fetch(SEC_COMPANY_TICKERS_URL, {
    headers: {
      'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)',
      'Accept': 'application/json',
    },
    // Follow robots/terms
  });
  if (!resp.ok) {
    throw new Error(`Failed to download company_tickers.json: ${resp.status}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(filePath, buf);
}

export async function loadCompanyTickers(): Promise<Map<string, TickerInfo>> {
  await downloadCompanyTickers(false);
  const filePath = getCachePath();
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const map = new Map<string, TickerInfo>();
  for (const key of Object.keys(json)) {
    const rec = json[key];
    map.set(rec.ticker.toUpperCase(), { cik10: toCik10(rec.cik_str), name: rec.title });
  }
  return map;
}

export async function getCIKByTicker(ticker: string): Promise<string> {
  const map = await loadCompanyTickers();
  const info = map.get(ticker.toUpperCase());
  if (!info) {
    throw new Error(`Ticker not found: ${ticker}`);
  }
  return info.cik10;
}


