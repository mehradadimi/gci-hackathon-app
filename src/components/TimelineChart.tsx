import QuickChart from 'quickchart-js';

type Pair = { label: string; promised: number; delivered: number };

export async function TimelineChart({ pairs, outPath }: { pairs: Pair[]; outPath?: string }) {
  const qc = new QuickChart();
  qc.setWidth(600).setHeight(300).setBackgroundColor('white');
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
  // In a server environment we could write to /public/charts; here we just return img URL
  const url = await qc.getShortUrl();
  return (
    <img src={url} alt="Promised vs Delivered" className="max-w-full" />
  );
}


