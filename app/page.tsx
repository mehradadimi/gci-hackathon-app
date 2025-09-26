"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type TickerItem = { ticker: string; name: string };

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TickerItem[]>([]);
  const [filtered, setFiltered] = useState<TickerItem[]>([]);

  useEffect(() => {
    fetch('/api/tickers')
      .then((r) => r.json())
      .then((data: TickerItem[]) => setItems(data))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    const q = query.trim().toUpperCase();
    if (!q) {
      setFiltered(items.slice(0, 8));
      return;
    }
    const f = items.filter((it) => it.ticker.includes(q) || it.name.toUpperCase().includes(q)).slice(0, 8);
    setFiltered(f);
  }, [query, items]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = query.trim().toUpperCase();
    if (!t) return;
    router.push(`/company/${t}`);
  }

  function tryDemo() {
    setQuery('AAPL');
    router.push('/company/AAPL');
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <section className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Guidance Credibility Index</h1>
        <p className="text-neutral-700">Search any ticker and compare promised vs delivered, language risk, and a single GCI score.</p>
        <div className="flex gap-3 mt-2">
          <button onClick={tryDemo} className="rounded bg-neutral-900 text-white px-3 py-2 text-sm hover:opacity-90">Try Demo Set</button>
        </div>
      </section>
      <section className="mt-10">
        <form onSubmit={onSubmit} className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter ticker (e.g., AAPL)"
            className="w-full rounded border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-400"
          />
          <button type="submit" className="rounded bg-neutral-900 text-white px-3 py-2 text-sm hover:opacity-90">Go</button>
        </form>
        <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2" aria-live="polite">
          {filtered.map((it) => (
            <li key={it.ticker}>
              <button onClick={() => router.push(`/company/${it.ticker}`)} className="w-full text-left rounded border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
                <span className="font-medium">{it.ticker}</span>
                <span className="ml-2 text-neutral-600">{it.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}


