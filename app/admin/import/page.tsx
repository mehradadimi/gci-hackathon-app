"use client";
import { useState } from 'react';

async function post(url: string, tickers: string[]) {
  const u = `${url}?tickers=${encodeURIComponent(tickers.join(','))}`;
  const res = await fetch(u, { method: 'POST' });
  return res.json();
}

export default function AdminImportPage() {
  const [tickers, setTickers] = useState('COST');
  const [logs, setLogs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(step: 'fetch' | 'guidance' | 'actuals' | 'language' | 'score') {
    setBusy(true);
    const list = tickers.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
    let url = '';
    if (step === 'fetch') url = '/api/admin/import/fetch-filings';
    if (step === 'guidance') url = '/api/admin/import/parse-guidance';
    if (step === 'actuals') url = '/api/admin/import/pull-actuals';
    if (step === 'language') url = '/api/admin/import/analyze-language';
    if (step === 'score') url = '/api/admin/import/score-gci';
    const out = await post(url, list);
    setLogs((prev) => [{ step, out, at: new Date().toISOString() }, ...prev]);
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Admin Import</h1>
      <div className="flex items-center gap-3">
        <input value={tickers} onChange={(e) => setTickers(e.target.value)} className="w-full rounded border border-neutral-300 px-3 py-2" placeholder="Tickers, comma-separated" />
        <button disabled={busy} onClick={() => run('fetch')} className="rounded bg-neutral-900 px-3 py-2 text-white text-sm">Fetch Filings</button>
        <button disabled={busy} onClick={() => run('guidance')} className="rounded bg-neutral-900 px-3 py-2 text-white text-sm">Parse Guidance</button>
        <button disabled={busy} onClick={() => run('actuals')} className="rounded bg-neutral-900 px-3 py-2 text-white text-sm">Pull Actuals</button>
        <button disabled={busy} onClick={() => run('language')} className="rounded bg-neutral-900 px-3 py-2 text-white text-sm">Analyze Language</button>
        <button disabled={busy} onClick={() => run('score')} className="rounded bg-neutral-900 px-3 py-2 text-white text-sm">Score GCI</button>
      </div>
      <section className="rounded border border-neutral-200 p-4">
        <h2 className="font-semibold">Logs</h2>
        <pre className="mt-3 max-h-96 overflow-auto text-xs bg-neutral-50 p-3">{JSON.stringify(logs, null, 2)}</pre>
      </section>
    </main>
  );
}


