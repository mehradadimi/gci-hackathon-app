import fs from 'fs';
import path from 'path';

// Simple throttle: ≤10 req/s to data.sec.gov
let throttleChain: Promise<any> = Promise.resolve();
let lastRequestAt = 0;
let queued = 0;
let loggedHeaders = false;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enqueueThrottled<T>(fn: () => Promise<T>): Promise<T> {
  queued++;
  const run = async () => {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    const waitMs = elapsed >= 100 ? 0 : 100 - elapsed; // 100ms spacing → 10 rps
    if (waitMs > 0) await delay(waitMs);
    lastRequestAt = Date.now();
    queued--;
    // eslint-disable-next-line no-console
    console.log(`[SEC_THROTTLE] queued=${queued}`);
    return fn();
  };
  // Chain to preserve order under burst
  const p = throttleChain.then(run, run);
  throttleChain = p.catch(() => undefined);
  return p;
}

export async function fetchSecJson(url: string): Promise<{ url: string; status: number; json: any }> {
  const headers: Record<string, string> = {
    'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)',
    'Accept': 'application/json',
  };
  if (!loggedHeaders) {
    // eslint-disable-next-line no-console
    console.log('[SEC_HEADERS]', headers);
    loggedHeaders = true;
  }
  return enqueueThrottled(async () => {
    const resp = await fetch(url, { headers });
    const status = resp.status;
    const text = await resp.text();
    try {
      const json = text ? JSON.parse(text) : {};
      return { url, status, json };
    } catch (e) {
      return { url, status, json: { parseError: String(e), body: text } };
    }
  });
}

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

async function readCacheStale(key: string): Promise<string | undefined> {
  const p = cachePathFor(key);
  if (!fs.existsSync(p)) return undefined;
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
  const { status, json } = await fetchSecJson(url);
  if (status < 200 || status >= 300) {
    const stale = await readCacheStale(key);
    if (stale) return JSON.parse(stale);
    throw new Error(`SEC submissions error ${status}`);
  }
  await writeCache(key, JSON.stringify(json));
  return json;
}

export async function getCompanyConcept(cik10: string, tag: string): Promise<any> {
  const key = `concept-${cik10}-${tag}.json`;
  const cached = await readCache(key, DAY_MS);
  if (cached) return JSON.parse(cached);

  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik10}/us-gaap/${encodeURIComponent(tag)}.json`;
  const { status, json } = await fetchSecJson(url);
  if (status < 200 || status >= 300) {
    const stale = await readCacheStale(key);
    if (stale) return JSON.parse(stale);
    throw new Error(`SEC concept error ${status}`);
  }
  await writeCache(key, JSON.stringify(json));
  return json;
}


