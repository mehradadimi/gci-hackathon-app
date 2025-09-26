import { getCIKByTicker } from '@/src/server/cik';
import { GciBadge } from '@/src/components/GciBadge';
import { MetricChips } from '@/src/components/MetricChips';
import { SourceLinks } from '@/src/components/SourceLinks';
import {
  getCompanyByTicker,
  getLatestLanguageMetricsForCompany,
  getLatestPeriodLinks,
  getLatestScoreForCompany,
  getRevenuePairsForCompany,
  getDeliveredSeriesForCompany,
} from '@/src/server/repo';
import QuickChart from 'quickchart-js';
import { ensureCompanyBasics, warmActualsFromSEC } from './actions';

async function buildTimelineUrl(pairs: Array<{ label: string; promised: number; delivered: number }>): Promise<string | null> {
  if (!pairs.length) return null;
  const qc = new QuickChart();
  qc.setWidth(700).setHeight(300).setBackgroundColor('white');
  qc.setConfig({
    type: 'bar',
    data: {
      labels: pairs.map((p) => p.label),
      datasets: [
        { label: 'Promised', data: pairs.map((p) => p.promised) },
        { label: 'Delivered', data: pairs.map((p) => p.delivered) },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
  return await qc.getShortUrl();
}

export default async function CompanyPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  let cik10: string | null = null;
  try {
    cik10 = await ensureCompanyBasics(ticker);
    // opportunistically warm delivered actuals so first view has data
    await warmActualsFromSEC(ticker);
  } catch {
    cik10 = null;
  }

  const company = await getCompanyByTicker(ticker);
  const companyId = company?.id ?? null;
  const score = companyId ? await getLatestScoreForCompany(companyId) : undefined;
  const lm = companyId ? await getLatestLanguageMetricsForCompany(companyId) : undefined;
  const links = companyId ? await getLatestPeriodLinks(companyId) : undefined;
  let pairs = companyId ? await getRevenuePairsForCompany(companyId) : [];
  let timelineUrl = await buildTimelineUrl(pairs);
  if (!timelineUrl && companyId) {
    const deliveredOnly = await getDeliveredSeriesForCompany(companyId);
    const converted = deliveredOnly.map((d) => ({ label: d.label, promised: d.delivered, delivered: d.delivered }));
    timelineUrl = await buildTimelineUrl(converted);
  }

  const hasData = Boolean(score || (pairs && pairs.length) || lm);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">{ticker}</h1>
          <p className="text-neutral-600">CIK: {cik10 ?? 'Unknown'}</p>
        </div>
        <div>
          {score?.gci != null ? (
            <GciBadge score={Number(score.gci)} />
          ) : (
            <span className="text-sm text-neutral-500">No score yet</span>
          )}
        </div>
      </header>

      {!hasData ? (
        <div className="rounded border border-neutral-200 p-6">
          <p className="text-neutral-700">No data found yet for {ticker}.</p>
          <a className="mt-3 inline-block rounded bg-neutral-900 px-3 py-2 text-sm text-white hover:opacity-90" href={`/admin/import?ticker=${ticker}`}>
            Import Data
          </a>
        </div>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded border border-neutral-200 p-4">
          <h2 className="font-semibold">Promised vs Delivered</h2>
          {timelineUrl ? (
            <img src={timelineUrl} alt="Promised vs Delivered" className="mt-3 w-full" />
          ) : (
            <p className="mt-3 text-sm text-neutral-600">No timeline data.</p>
          )}
        </div>
        <div className="rounded border border-neutral-200 p-4">
          <h2 className="font-semibold">Language Risk</h2>
          {lm ? (
            <div className="mt-3">
              <MetricChips
                flags={[
                  `hedges/1k: ${Math.round((lm.hedges_per_k ?? 0) * 10) / 10}`,
                  `uncertainty/1k: ${Math.round((lm.uncertainty_per_k ?? 0) * 10) / 10}`,
                ]}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-600">No language metrics.</p>
          )}
        </div>
      </section>

      <section className="rounded border border-neutral-200 p-4">
        <h2 className="font-semibold">Breakdown</h2>
        {score ? (
          <ul className="mt-3 text-sm text-neutral-700 grid grid-cols-2 md:grid-cols-4 gap-3">
            <li title="Timeliness & Accuracy">TRA: {Math.round(Number(score.tra ?? 0))}</li>
            <li title="Consistency vs Volatility">CVP: {Math.round(Number(score.cvp ?? 0))}</li>
            <li title="Language Risk">LR: {Math.round(Number(score.lr ?? 0))}</li>
            <li>GCI: {Math.round(Number(score.gci ?? 0))} {score.badge ? `(${score.badge})` : ''}</li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-600">No score breakdown.</p>
        )}
      </section>

      <section className="rounded border border-neutral-200 p-4">
        <h2 className="font-semibold">Sources</h2>
        <div className="mt-3">
          <SourceLinks filingUrl={links?.exhibit_991_url ?? links?.source_8k_url ?? null} transcriptUrl={links?.transcript_url ?? null} />
        </div>
      </section>
    </main>
  );
}


