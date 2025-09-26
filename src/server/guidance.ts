import { getCompanySubmissions } from './sec';
import { ensurePeriod, getCompanyByTicker, insertGuidance, insertExhibit } from './repo';
import { load as loadHtml } from 'cheerio';
import fs from 'fs';
import path from 'path';

export type NormalizedGuidance = {
  period: { fy: number | null; fp: string | null };
  metric: 'revenue' | 'eps_diluted';
  min: number | null;
  max: number | null;
  units: 'USD_M' | 'EPS';
  basis: 'GAAP' | 'non-GAAP' | null;
  extracted_text: string;
  exhibit_991_url: string | null;
  source_exhibit?: string | null;
  segment?: string | null;
};

function parseDollarRangeToUsdM(text: string): { min: number | null; max: number | null } | null {
  // Examples: $5.2–$5.4B, $5200-$5400 million, $5.2 billion
  const bMatch = text.match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*(?:–|-|to|and)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(B|b|bn|billion|M|m|mm|million|\bB\b|\bM\b)?/);
  if (bMatch) {
    const a = parseFloat(bMatch[1]);
    const b = parseFloat(bMatch[2]);
    const unit = (bMatch[3] || '').toLowerCase();
    const isB = /^(b|bn|billion|\bB\b)$/.test(unit);
    const factor = isB ? 1000 : 1; // B to USD_M, M stays
    return { min: Math.round(a * factor * 100) / 100, max: Math.round(b * factor * 100) / 100 };
  }
  const single = text.match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*(B|b|bn|billion|M|m|mm|million)/);
  if (single) {
    const v = parseFloat(single[1]);
    const unit = (single[2] || '').toLowerCase();
    const isB = /^(b|bn|billion|\bB\b)$/.test(unit);
    const factor = isB ? 1000 : 1;
    return { min: Math.round(v * factor * 100) / 100, max: Math.round(v * factor * 100) / 100 };
  }
  return null;
}

function parseEpsRange(text: string): { min: number | null; max: number | null } | null {
  const m = text.match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*(?:–|-|to)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (m) return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
  const s = text.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
  if (s) return { min: parseFloat(s[1]), max: parseFloat(s[1]) };
  return null;
}

function detectBasis(text: string): 'GAAP' | 'non-GAAP' | null {
  if (/non-?GAAP/i.test(text)) return 'non-GAAP';
  if (/GAAP/i.test(text)) return 'GAAP';
  return null;
}

async function findExhibit991Url(cik10: string, accession: string, primaryDoc: string): Promise<{ exhibitUrl: string; primaryUrl: string }> {
  const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik10)}/${accession.replace(/-/g, '')}`;
  const indexUrl = `${base}/${accession.replace(/-/g, '')}-index.html`;
  const resp = await fetch(indexUrl, { headers: { 'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)' } });
  if (!resp.ok) {
    return { exhibitUrl: `${base}/${primaryDoc}`, primaryUrl: `${base}/${primaryDoc}` };
  }
  const html = await resp.text();
  const $ = loadHtml(html);
  const anchors = $('a[href]').toArray().map((el) => $(el).attr('href') || '').filter(Boolean);
  const prefer = (regex: RegExp) => anchors.find((h) => regex.test(h));
  let href = prefer(/99\.1[^\s]*\.(html?|htm)/i) || prefer(/99\.1[^\s]*\.txt$/i) || prefer(/99\.1/i) || '';
  if (!href) href = primaryDoc;
  const toAbs = (h: string) => (h.startsWith('http') ? h : h.startsWith('/') ? `https://www.sec.gov${h}` : `${base}/${h}`);
  return { exhibitUrl: toAbs(href), primaryUrl: `${base}/${primaryDoc}` };
}

type ExhibitMeta = { exNo: string; url: string; contentType: string; fileName: string };

async function discoverExhibits(cik10: string, accession: string, primaryDoc: string): Promise<ExhibitMeta[]> {
  const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik10)}/${accession.replace(/-/g, '')}`;
  const indexUrl = `${base}/${accession.replace(/-/g, '')}-index.html`;
  const out: ExhibitMeta[] = [];
  try {
    const resp = await fetch(indexUrl, { headers: { 'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)' } });
    if (!resp.ok) throw new Error(String(resp.status));
    const html = await resp.text();
    const $ = loadHtml(html);
    $('tr').each((_, tr) => {
      const tds = $(tr).find('td');
      const rowText = $(tr).text();
      const link = $(tr).find('a[href]').first();
      const href = link.attr('href') || '';
      const fileName = href.split('/').pop() || '';
      const type = tds.eq(3).text().trim();
      const exMatch =
        type.match(/EX-?99\.(\d+)/i) ||
        rowText.match(/Exhibit\s+99\.(\d+)/i) ||
        fileName.match(/ex-?99\.(\d+)/i) ||
        fileName.match(/99\.(\d+)/);
      if (!exMatch) return;
      const exNo = `99.${exMatch[1]}`;
      const absUrl = href.startsWith('http') ? href : href.startsWith('/') ? `https://www.sec.gov${href}` : `${base}/${href}`;
      const contentType = fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : fileName.toLowerCase().match(/\.htm(l)?$/) ? 'text/html' : 'text/plain';
      out.push({ exNo, url: absUrl, contentType, fileName });
    });
  } catch {
    // ignore
  }
  // Fallback: include primary doc if nothing found
  if (out.length === 0) {
    out.push({ exNo: 'primary', url: `${base}/${primaryDoc}`, contentType: primaryDoc.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/html', fileName: primaryDoc });
  }
  // Ensure unique by exNo then url
  const uniq: ExhibitMeta[] = [];
  const seen = new Set<string>();
  for (const e of out) {
    const key = `${e.exNo}|${e.url}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(e); }
  }
  return uniq;
}

async function readPdfText(buf: Buffer): Promise<string> {
  const mod = await import('pdf-parse');
  const pdfParse = (mod as any).default || (mod as any);
  const data = await pdfParse(buf);
  return String(data.text || '').replace(/\s+/g, ' ').trim();
}

async function fetchExhibitText(url: string, contentTypeHint: string): Promise<{ text: string; contentType: string }> {
  const resp = await fetch(url, { headers: { 'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)' } });
  const contentType = resp.headers.get('content-type') || contentTypeHint || 'text/plain';
  if (!resp.ok) return { text: '', contentType };
  if (/pdf/i.test(contentType) || url.toLowerCase().endsWith('.pdf')) {
    const ab = await resp.arrayBuffer();
    const buf = Buffer.from(ab);
    const text = await readPdfText(buf);
    return { text, contentType: 'application/pdf' };
  } else {
    const html = await resp.text();
    const $ = loadHtml(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return { text, contentType: 'text/html' };
  }
}

function cacheExhibitText(cik10: string, accession: string, exNo: string, text: string): string {
  const dir = path.join(process.cwd(), '.cache', 'exhibits');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${cik10}-${accession.replace(/-/g, '')}-${exNo}.txt`);
  fs.writeFileSync(p, text, 'utf-8');
  return p;
}

function cacheGuidanceText(ticker: string, label: string, text: string): string {
  const dir = path.join(process.cwd(), '.cache', 'guidance');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${ticker}-${label}.txt`);
  fs.writeFileSync(p, text, 'utf-8');
  return p;
}

function parseNumberAndUnit(numStr: string, unitStr: string | undefined): number {
  const clean = numStr.replace(/[,]/g, '');
  const v = parseFloat(clean);
  const unit = (unitStr || '').toLowerCase();
  const isB = /^(b|bn|billion|\bB\b)$/.test(unit);
  return isB ? v * 1000 : v; // return in USD_M
}

function extractFromText(text: string, exNo: string): NormalizedGuidance[] {
  const out: NormalizedGuidance[] = [];
  const sentences = text.split(/[\.!?\n;](\s|$)/).map((s) => s.trim()).filter(Boolean);
  const pushRev = (min: number, max: number, extracted: string, segment?: string | null) => {
    out.push({ period: { fy: null, fp: null }, metric: 'revenue', min, max, units: 'USD_M', basis: null, extracted_text: extracted, exhibit_991_url: null, source_exhibit: exNo, segment: segment || null });
  };
  const pushEps = (min: number, max: number, extracted: string) => {
    out.push({ period: { fy: null, fp: null }, metric: 'eps_diluted', min, max, units: 'EPS', basis: null, extracted_text: extracted, exhibit_991_url: null, source_exhibit: exNo, segment: null });
  };

  // Heuristic skip: if 99.1 says guidance will be provided on call
  if (/will provide forward[- ]looking guidance on the (earnings )?(call|webcast)/i.test(text) && exNo === '99.1') {
    return out; // do not extract numeric from 99.1
  }

  // NVDA-style plus/minus %
  const plusMinus = /revenue\s+(?:is|are)?\s*(?:expected to be|to be)\s*\$?([\d.,]+)\s*(b|bn|billion|m|million)?\s*,?\s*(?:plus or minus|±)\s*([\d.]+)\s*%/i;
  for (const s of sentences) {
    const m = s.match(plusMinus);
    if (m) {
      const mid = parseNumberAndUnit(m[1], m[2]);
      const pct = parseFloat(m[3]);
      const min = Math.round((mid * (1 - pct / 100)) * 100) / 100;
      const max = Math.round((mid * (1 + pct / 100)) * 100) / 100;
      pushRev(min, max, s);
    }
  }

  // Explicit range
  const rangeRe = /revenue\s+(?:is|are)?\s*(?:expected to be|to be|between)?\s*(?:between\s*)?\$?([\d.,]+)\s*(b|bn|billion|m|million)\s*(?:to|–|—|-|~)\s*\$?([\d.,]+)\s*(b|bn|billion|m|million)/i;
  for (const s of sentences) {
    const m = s.match(rangeRe);
    if (m) {
      const min = parseNumberAndUnit(m[1], m[2]);
      const max = parseNumberAndUnit(m[3], m[4]);
      pushRev(Math.min(min, max), Math.max(min, max), s);
    }
  }

  // Segment guidance (MSFT)
  const segRe = /In\s+(Productivity and Business Processes|Intelligent Cloud|More Personal Computing)[^\.]*?we\s+expect\s+revenue\s+of\s+\$?([\d.,]+)\s*(b|bn|billion|m|million)\s*(?:to|–|—|-|~)\s*\$?([\d.,]+)\s*(b|bn|billion|m|million)/i;
  for (const s of sentences) {
    const m = s.match(segRe);
    if (m) {
      const segment = m[1];
      const min = parseNumberAndUnit(m[2], m[3]);
      const max = parseNumberAndUnit(m[4], m[5]);
      pushRev(Math.min(min, max), Math.max(min, max), s, segment);
    }
  }

  // EPS range
  const epsRe = /(diluted\s+)?eps\s+(?:is|are)?\s*(?:expected to be|outlook)\s*\$?([\d.]+)\s*(?:to|–|—|-|~)\s*\$?([\d.]+)/i;
  for (const s of sentences) {
    const m = s.match(epsRe);
    if (m) {
      const a = parseFloat(m[2]);
      const b = parseFloat(m[3]);
      pushEps(Math.min(a, b), Math.max(a, b), s);
    }
  }

  return out;
}

export async function extractGuidanceFromLatest8K(ticker: string): Promise<NormalizedGuidance[]> {
  // 1) Get submissions, find latest 8-K with Item 2.02
  const company = await getCompanyByTicker(ticker);
  if (!company) throw new Error(`Unknown company: ${ticker}`);
  const subs = await getCompanySubmissions(company.cik);
  const recent = subs?.filings?.recent;
  if (!recent) return [];
  const idxs = (recent.form || []).map((f: string, i: number) => ({ f, i }))
    .filter((x: any) => x.f === '8-K');

  const entries = idxs.map(({ i }) => ({
    accession: recent.accessionNumber[i],
    primaryDoc: recent.primaryDocument[i],
    filingDate: recent.filingDate[i],
  }));
  const results: NormalizedGuidance[] = [];
  for (const entry of entries.slice(0, 4)) {
    const exhibits = await discoverExhibits(company.cik, entry.accession, entry.primaryDoc);
    // Heuristic: if 99.1 present and says guidance will be on call, prioritize 99.2 before 99.1
    let ordered = exhibits.filter(e => /^99\./.test(e.exNo));
    if (ordered.length === 0) ordered = exhibits; // fallback include primary doc
    const has991 = ordered.find(e => e.exNo === '99.1');
    if (has991) {
      const { text } = await fetchExhibitText(has991.url, has991.contentType);
      if (/will provide forward[- ]looking guidance on the (earnings )?(call|webcast)/i.test(text)) {
        ordered = ordered.sort((a, b) => (a.exNo === '99.2' ? -1 : b.exNo === '99.2' ? 1 : a.exNo.localeCompare(b.exNo)));
      }
    }

    const periodId = await ensurePeriod({
      companyId: company.id,
      fy: null,
      fp: null,
      periodEnd: null,
      source8kUrl: `https://www.sec.gov/ixviewer/doc?action=display&source=${encodeURIComponent(entry.accession)}`,
      exhibit991Url: null,
      transcriptUrl: null,
    });

    for (const ex of ordered) {
      const { text, contentType } = await fetchExhibitText(ex.url, ex.contentType);
      const cachePath = cacheExhibitText(company.cik, entry.accession, ex.exNo, text);
      const hintOnCall = /will provide forward[- ]looking guidance on the (earnings )?(call|webcast)/i.test(text) && ex.exNo === '99.1';
      await insertExhibit({ periodId, exNo: ex.exNo, url: ex.url, contentType, fileName: ex.fileName, textCachePath: cachePath, hintGuidanceOnCall: hintOnCall });
      const found = extractFromText(text, ex.exNo);
      for (const f of found) {
        // Infer fy/fp from text if present
        const fyMatch = f.extracted_text.match(/FY\s*(\d{4})/i);
        const fy = fyMatch ? parseInt(fyMatch[1], 10) : null;
        const fpMatch = f.extracted_text.match(/\b(Q[1-4]|FY)\b/i);
        const fp = fpMatch ? fpMatch[1].toUpperCase() : null;
        if (f.metric === 'revenue') {
          await insertGuidance({ periodId, metric: 'revenue', minValue: f.min, maxValue: f.max, units: 'USD_M', basis: f.basis, extractedText: f.extracted_text, segment: f.segment ?? null, sourceUrl: ex.url });
        } else if (f.metric === 'eps_diluted') {
          await insertGuidance({ periodId, metric: 'eps_diluted', minValue: f.min, maxValue: f.max, units: 'EPS', basis: f.basis, extractedText: f.extracted_text, segment: f.segment ?? null, sourceUrl: ex.url });
        }
        results.push({ ...f, period: { fy, fp }, exhibit_991_url: ex.url });
      }
      if (results.length > 0) break;
    }
    if (results.length > 0) break;
  }

  return results;
}


export async function debugScanExhibits(ticker: string): Promise<Array<{ ex_no: string; url: string; content_type: string; hint_guidance_on_call: boolean; snippet: string }>> {
  const out: Array<{ ex_no: string; url: string; content_type: string; hint_guidance_on_call: boolean; snippet: string }> = [];
  const company = await getCompanyByTicker(ticker);
  if (!company) return out;
  const subs = await getCompanySubmissions(company.cik);
  const recent = subs?.filings?.recent;
  if (!recent) return out;
  const idxs = (recent.form || []).map((f: string, i: number) => ({ f, i })).filter((x: any) => x.f === '8-K');
  const entries = idxs.map(({ i }) => ({ accession: recent.accessionNumber[i], primaryDoc: recent.primaryDocument[i] }));
  const first = entries[0];
  if (!first) return out;
  const exhibits = await discoverExhibits(company.cik, first.accession, first.primaryDoc);
  for (const ex of exhibits) {
    const { text, contentType } = await fetchExhibitText(ex.url, ex.contentType);
    const hint = /will provide forward[- ]looking guidance on the (earnings )?(call|webcast)/i.test(text) && ex.exNo === '99.1';
    out.push({ ex_no: ex.exNo, url: ex.url, content_type: contentType, hint_guidance_on_call: hint, snippet: (text || '').slice(0, 300) });
  }
  return out;
}

// Issuer-specific adapters
async function fetchText(url: string): Promise<string> {
  const resp = await fetch(url, { headers: { 'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)' } });
  if (!resp.ok) return '';
  const ct = resp.headers.get('content-type') || '';
  if (/pdf/i.test(ct) || url.toLowerCase().endsWith('.pdf')) {
    const ab = await resp.arrayBuffer();
    return readPdfText(Buffer.from(ab));
  }
  const html = await resp.text();
  const $ = loadHtml(html);
  return $('body').text().replace(/\s+/g, ' ').trim();
}

export async function adapterNVDA(): Promise<NormalizedGuidance[] | null> {
  const urls = [
    'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2026',
    'https://nvidianews.nvidia.com/_gallery/download_pdf/68af69043d6332f1d02dec91/',
    'https://s201.q4cdn.com/141608511/files/doc_financials/2026/Q226/Q2FY26-CFO-Commentary.pdf',
  ];
  const out: NormalizedGuidance[] = [];
  for (const url of urls) {
    const text = await fetchText(url);
    if (!text) continue;
    cacheGuidanceText('NVDA', url.split('/').slice(2,4).join('-'), text);
    const m = text.match(/revenue\s+(?:is|are)?\s*expected\s*to\s*be\s*\$?([\d.,]+)\s*(billion|bn|million|m)?\s*,?\s*(?:plus\s*or\s*minus|±)\s*([\d.]+)\s*%/i);
    if (m) {
      const mid = parseNumberAndUnit(m[1], m[2]);
      const pct = parseFloat(m[3]);
      const min = Math.round((mid * (1 - pct / 100)) * 100) / 100;
      const max = Math.round((mid * (1 + pct / 100)) * 100) / 100;
      out.push({ period: { fy: null, fp: null }, metric: 'revenue', min, max, units: 'USD_M', basis: null, extracted_text: m[0].slice(0, 160), exhibit_991_url: url, source_exhibit: url, segment: null });
      break;
    }
  }
  return out.length ? out : null;
}

export async function adapterMSFT(): Promise<NormalizedGuidance[] | null> {
  const root = 'https://www.microsoft.com/en-us/investor/events/fy-2025/earnings-fy-2025-q4';
  const out: NormalizedGuidance[] = [];

  async function fetchHtml(url: string): Promise<{ text: string; html: string; anchors: string[] }> {
    const resp = await fetch(url, { headers: { 'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)' } });
    if (!resp.ok) return { text: '', html: '', anchors: [] };
    const html = await resp.text();
    const $ = loadHtml(html);
    const raw = $('body').text();
    const text = raw.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
    const anchors = $('a[href]')
      .toArray()
      .map((a) => $(a).attr('href') || '')
      .filter((h) => !!h && !/^mailto:|^javascript:|^tel:|^#/.test(h))
      .map((h) => {
        try {
          return h.startsWith('http') ? h : new URL(h, url).toString();
        } catch {
          return '';
        }
      })
      .filter(Boolean);
    return { text, html, anchors };
  }

  function inferPeriodFromUrl(url: string): { fy: number | null; fp: string | null } {
    const m = url.match(/fy[-_]?(\d{4})[-_]?q(\d)/i);
    if (m) {
      return { fy: parseInt(m[1], 10), fp: `Q${m[2]}`.toUpperCase() };
    }
    return { fy: null, fp: null };
  }

  const segRe = /(productivity and business processes|intelligent cloud|more personal computing)[^\n]{0,120}?(revenue\s+of|we\s+expect\s+revenue\s+of)\s*\$?([\d.,]+)\s*(b|bn|billion|m|million)\s*(?:to|–|—|-|~)\s*\$?([\d.,]+)\s*(b|bn|billion|m|million)/i;

  // 1) Primary IR event page
  const { text: rootText, anchors } = await fetchHtml(root);
  if (rootText) cacheGuidanceText('MSFT', 'fy25q4', rootText);
  let m = rootText.toLowerCase().match(segRe);
  if (m) {
    const segment = m[1].replace(/\b\w/g, (c) => c.toUpperCase());
    const min = parseNumberAndUnit(m[3], m[4]);
    const max = parseNumberAndUnit(m[6], m[7]);
    const { fy, fp } = inferPeriodFromUrl(root);
    out.push({ period: { fy, fp }, metric: 'revenue', min: Math.min(min, max), max: Math.max(min, max), units: 'USD_M', basis: null, extracted_text: m[0].slice(0, 160), exhibit_991_url: root, source_exhibit: root, segment });
  }

  // 2) Fallback: crawl a few same-domain links
  if (!out.length) {
    const candidates = anchors
      .filter((u) => /microsoft\.com/i.test(u))
      .filter((u) => /investor\//i.test(u))
      .filter((u) => /(fy-?2025|fy-?25|q4|prepared|remarks|outlook|slides|transcript|press)/i.test(u))
      .slice(0, 6);
    for (const url of candidates) {
      await new Promise((r) => setTimeout(r, 600));
      const { text } = await fetchHtml(url);
      if (!text) continue;
      cacheGuidanceText('MSFT', 'crawl', text);
      const mm = text.toLowerCase().replace(/[\u2013\u2014]/g, '-').match(segRe);
      if (mm) {
        const segment = mm[1].replace(/\b\w/g, (c) => c.toUpperCase());
        const min = parseNumberAndUnit(mm[3], mm[4]);
        const max = parseNumberAndUnit(mm[6], mm[7]);
        const { fy, fp } = inferPeriodFromUrl(url);
        out.push({ period: { fy, fp }, metric: 'revenue', min: Math.min(min, max), max: Math.max(min, max), units: 'USD_M', basis: null, extracted_text: mm[0].slice(0, 160), exhibit_991_url: url, source_exhibit: url, segment });
        break;
      }
    }
  }

  // 3) Asset index discovery for Outlook file
  if (!out.length) {
    const indexUrl = 'https://www.microsoft.com/en-us/investor/earnings/fy-2025-q4/segment-revenues';
    await new Promise((r) => setTimeout(r, 600));
    const { html, anchors } = await fetchHtml(indexUrl);
    const $ = loadHtml(html || '');
    let outlookLink = '';
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const txt = ($(a).text() || '').toLowerCase();
      if (/outlook/i.test(txt) || /outlook/i.test(href)) {
        outlookLink = href.startsWith('http') ? href : new URL(href, indexUrl).toString();
        return false;
      }
      return;
    });
    if (outlookLink) {
      await new Promise((r) => setTimeout(r, 650));
      const fetched = await fetchText(outlookLink);
      if (fetched) {
        const norm = fetched.toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ');
        cacheGuidanceText('MSFT', 'fy25q4-outlook', norm);
        const mm = norm.match(/(productivity and business processes|intelligent cloud|more personal computing)[^\n]{0,200}?(revenue\s+of|we\s+expect\s+revenue\s+of)\s*\$?([\d.,]+)\s*(b|bn|billion|m|million)\s*(?:to|–|—|-|~)\s*\$?([\d.,]+)\s*(b|bn|billion|m|million)/i);
        if (mm) {
          const segment = mm[1].replace(/\b\w/g, (c) => c.toUpperCase());
          const min = parseNumberAndUnit(mm[3], mm[4]);
          const max = parseNumberAndUnit(mm[6], mm[7]);
          const { fy, fp } = inferPeriodFromUrl(outlookLink);
          out.push({ period: { fy, fp }, metric: 'revenue', min: Math.min(min, max), max: Math.max(min, max), units: 'USD_M', basis: null, extracted_text: mm[0].slice(0, 160), exhibit_991_url: outlookLink, source_exhibit: outlookLink, segment });
          // eslint-disable-next-line no-console
          console.log('[MSFT_IR_MATCH]', { url: outlookLink, segment, min, max });
        } else {
          // eslint-disable-next-line no-console
          console.log('[MSFT_IR_NO_MATCH]', { url: outlookLink, sample: norm.slice(0, 200) });
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('[MSFT_IR_OUTLOOK_LINK_NOT_FOUND]', { indexUrl, anchorsCount: anchors.length });
    }
  }

  return out.length ? out : null;
}

export async function extractGuidanceIssuerAware(ticker: string): Promise<NormalizedGuidance[]> {
  // Try EDGAR first
  const edgar = await extractGuidanceFromLatest8K(ticker);
  if (edgar.length) return edgar;
  // Fallback adapters
  if (ticker.toUpperCase() === 'NVDA') {
    const nv = await adapterNVDA();
    if (nv && nv.length) {
      const company = await getCompanyByTicker('NVDA');
      if (company) {
        const periodId = await ensurePeriod({ companyId: company.id, fy: null, fp: null, periodEnd: null, source8kUrl: null, exhibit991Url: null, transcriptUrl: null });
        for (const g of nv) {
          await insertGuidance({ periodId, metric: g.metric, minValue: g.min, maxValue: g.max, units: g.units, basis: g.basis, extractedText: g.extracted_text, segment: g.segment ?? null, sourceUrl: g.source_exhibit || null });
        }
      }
    }
    return nv || [];
  }
  if (ticker.toUpperCase() === 'MSFT') {
    const ms = await adapterMSFT();
    if (ms && ms.length) {
      const company = await getCompanyByTicker('MSFT');
      if (company) {
        const periodId = await ensurePeriod({ companyId: company.id, fy: null, fp: null, periodEnd: null, source8kUrl: null, exhibit991Url: null, transcriptUrl: null });
        for (const g of ms) {
          await insertGuidance({ periodId, metric: g.metric, minValue: g.min, maxValue: g.max, units: g.units, basis: g.basis, extractedText: g.extracted_text, segment: g.segment ?? null, sourceUrl: g.source_exhibit || null });
        }
      }
    }
    return ms || [];
  }
  return [];
}


