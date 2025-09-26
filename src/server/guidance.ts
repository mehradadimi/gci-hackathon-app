import { getCompanySubmissions } from './sec';
import { ensurePeriod, getCompanyByTicker, insertGuidance } from './repo';
import { load as loadHtml } from 'cheerio';

export type NormalizedGuidance = {
  period: { fy: number | null; fp: string | null };
  metric: 'revenue' | 'eps_diluted';
  min: number | null;
  max: number | null;
  units: 'USD_M' | 'EPS';
  basis: 'GAAP' | 'non-GAAP' | null;
  extracted_text: string;
  exhibit_991_url: string | null;
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
  for (const entry of entries.slice(0, 8)) {
    const { exhibitUrl, primaryUrl } = await findExhibit991Url(company.cik, entry.accession, entry.primaryDoc);
    const tryUrls = [exhibitUrl, primaryUrl];
    for (const url of tryUrls) {
      const htmlResp = await fetch(url, {
        headers: { 'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)' },
      });
      if (!htmlResp.ok) continue;
      const html = await htmlResp.text();
      const $ = loadHtml(html);
      const text = $('body').text().replace(/\s+/g, ' ').trim();

    const candidates = text.split(/[\.!?\n;](\s|$)/).map((s) => s.trim()).filter(Boolean);

      for (const sentence of candidates) {
      if (!/(guidance|outlook|expects|sees|range|between|forecast|project|estimates?)/i.test(sentence)) continue;
        const revenue = parseDollarRangeToUsdM(sentence);
        const eps = parseEpsRange(sentence);
        const basis = detectBasis(sentence);

        const fyMatch = sentence.match(/FY\s*(\d{4})/i);
        const fy = fyMatch ? parseInt(fyMatch[1], 10) : null;
        const fpMatch = sentence.match(/\b(Q[1-4]|FY)\b/i);
        const fp = fpMatch ? fpMatch[1].toUpperCase() : null;

        const periodId = await ensurePeriod({
          companyId: company.id,
          fy,
          fp,
          periodEnd: null,
          source8kUrl: `https://www.sec.gov/ixviewer/doc?action=display&source=${encodeURIComponent(entry.accession)}`,
          exhibit991Url: url,
          transcriptUrl: null,
        });

        if (revenue) {
          await insertGuidance({
            periodId,
            metric: 'revenue',
            minValue: revenue.min,
            maxValue: revenue.max,
            units: 'USD_M',
            basis,
            extractedText: sentence,
          });
          results.push({ period: { fy, fp }, metric: 'revenue', min: revenue.min, max: revenue.max, units: 'USD_M', basis, extracted_text: sentence, exhibit_991_url: url });
        }
        if (eps) {
          await insertGuidance({
            periodId,
            metric: 'eps_diluted',
            minValue: eps.min,
            maxValue: eps.max,
            units: 'EPS',
            basis,
            extractedText: sentence,
          });
          results.push({ period: { fy, fp }, metric: 'eps_diluted', min: eps.min, max: eps.max, units: 'EPS', basis, extracted_text: sentence, exhibit_991_url: url });
        }
      }

      if (results.length > 0) break;
    }
  }

  return results;
}


