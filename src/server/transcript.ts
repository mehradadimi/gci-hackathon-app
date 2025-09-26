import { getCompanyByTicker, ensurePeriod, insertLanguageMetrics } from './repo';
import { getCompanySubmissions } from './sec';
import { load as loadHtml } from 'cheerio';

const HEDGES = [
  'may','might','could','approximately','around','about','likely','possible','potential','expect','estimate','anticipate','forecast','project'
];
const NEGATIONS = ['not','no','never','none','without'];
const UNCERTAINTY = ['uncertain','visibility','headwinds','challenging','volatility','risk','cautious'];
const VAGUE = ['somewhat','kind of','relatively','roughly','sort of'];

function countPerThousand(words: string[], lexicon: string[]): number {
  const set = new Set(lexicon.map((w) => w.toLowerCase()));
  const total = words.length || 1;
  let hits = 0;
  for (const w of words) if (set.has(w.toLowerCase())) hits++;
  return (hits * 1000) / total;
}

export async function analyzeTranscriptQA(ticker: string, approxDate?: string): Promise<{
  words_total: number;
  hedges_per_k: number;
  negations_per_k: number;
  uncertainty_per_k: number;
  vague_per_k: number;
  source_section: 'Q&A' | 'Prepared';
}> {
  const company = await getCompanyByTicker(ticker);
  if (!company) throw new Error(`Unknown company: ${ticker}`);

  // Fallback: use last 8-K primary document text as proxy if transcript unavailable
  const subs = await getCompanySubmissions(company.cik);
  const recent = subs?.filings?.recent;
  const idx = (recent?.form || []).findIndex((f: string) => f === '8-K');
  if (idx === -1) {
    return { words_total: 0, hedges_per_k: 0, negations_per_k: 0, uncertainty_per_k: 0, vague_per_k: 0, source_section: 'Prepared' };
  }
  const accession = recent.accessionNumber[idx];
  const primaryDoc = recent.primaryDocument[idx];
  const base = `https://www.sec.gov/Archives/edgar/data/${Number(company.cik)}/${accession.replace(/-/g, '')}`;
  const url = `${base}/${primaryDoc}`;
  const resp = await fetch(url, { headers: { 'User-Agent': process.env.SEC_UA || 'GCI-Hackathon/1.0 (contact: you@example.com)' } });
  if (!resp.ok) {
    return { words_total: 0, hedges_per_k: 0, negations_per_k: 0, uncertainty_per_k: 0, vague_per_k: 0, source_section: 'Prepared' };
  }
  const html = await resp.text();
  const $ = loadHtml(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const words = text.split(/\W+/).filter(Boolean);
  return {
    words_total: words.length,
    hedges_per_k: countPerThousand(words, HEDGES),
    negations_per_k: countPerThousand(words, NEGATIONS),
    uncertainty_per_k: countPerThousand(words, UNCERTAINTY),
    vague_per_k: countPerThousand(words, VAGUE),
    source_section: 'Prepared',
  };
}

export async function analyzeAndStoreLanguageMetrics(ticker: string): Promise<{
  words_total: number;
  hedges_per_k: number;
  uncertainty_per_k: number;
}> {
  const company = await getCompanyByTicker(ticker);
  if (!company) throw new Error(`Unknown company: ${ticker}`);
  const metrics = await analyzeTranscriptQA(ticker);
  const periodId = await ensurePeriod({
    companyId: company.id,
    fy: null,
    fp: 'FY',
    periodEnd: null,
    source8kUrl: null,
    exhibit991Url: null,
    transcriptUrl: null,
  });
  await insertLanguageMetrics({
    periodId,
    wordsTotal: metrics.words_total,
    hedgesPerK: metrics.hedges_per_k,
    negationsPerK: metrics.negations_per_k,
    uncertaintyPerK: metrics.uncertainty_per_k,
    vaguePerK: metrics.vague_per_k,
    sourceSection: metrics.source_section,
  });
  return {
    words_total: metrics.words_total,
    hedges_per_k: metrics.hedges_per_k,
    uncertainty_per_k: metrics.uncertainty_per_k,
  };
}


