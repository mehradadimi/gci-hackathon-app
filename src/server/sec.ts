import fs from 'fs';
import path from 'path';

function cachePathFor(key: string): string {
  const dir = path.join(process.cwd(), '.cache', 'sec');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, key);
}

async function readCache(key: string, ttlMs: number): Promise<string | undefined> {
  const p = cachePathFor(key);
  if (!fs.existsSync(p)) return undefined;
  const stat = fs.statSync(p);
  if (Date.now() - stat.mtimeMs > ttlMs) return undefined;
  return fs.readFileSync(p, 'utf-8');
}

async function writeCache(key: string, data: string): Promise<void> {
  const p = cachePathFor(key);
  fs.writeFileSync(p, data);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getCompanySubmissions(cik10: string): Promise<any> {
  const key = `submissions-${cik10}.json`;
  const cached = await readCache(key, DAY_MS);
  if (cached) return JSON.parse(cached);

  const url = `https://data.sec.gov/submissions/CIK${cik10}.json`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)',
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) throw new Error(`SEC submissions error ${resp.status}`);
  const text = await resp.text();
  await writeCache(key, text);
  return JSON.parse(text);
}

export async function getCompanyConcept(cik10: string, tag: string): Promise<any> {
  const key = `concept-${cik10}-${tag}.json`;
  const cached = await readCache(key, DAY_MS);
  if (cached) return JSON.parse(cached);

  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik10}/us-gaap/${encodeURIComponent(tag)}.json`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)',
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) throw new Error(`SEC concept error ${resp.status}`);
  const text = await resp.text();
  await writeCache(key, text);
  return JSON.parse(text);
}


