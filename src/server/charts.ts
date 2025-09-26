import fs from 'fs';
import path from 'path';
import QuickChart from 'quickchart-js';
import { getCompanyByTicker, getRevenuePairsForCompanyDetailed } from './repo';

function ensurePublicChartsDir(): string {
  const dir = path.join(process.cwd(), 'public', 'charts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function generateRevenueChartForTicker(ticker: string): Promise<{ filePath: string | null; urlPath: string | null }> {
  const company = await getCompanyByTicker(ticker);
  if (!company) return { filePath: null, urlPath: null };

  const pairs = await getRevenuePairsForCompanyDetailed(company.id, 4);
  if (!pairs.length) return { filePath: null, urlPath: null };
  const fyLabel = pairs[0].fy != null ? String(pairs[0].fy) : 'NA';
  const chartsDir = ensurePublicChartsDir();
  const fileName = `${ticker}-${fyLabel}.png`;
  const filePath = path.join(chartsDir, fileName);
  const urlPath = `/charts/${fileName}`;

  // If file exists, return as cache hit
  if (fs.existsSync(filePath)) return { filePath, urlPath };

  const qc = new QuickChart();
  qc.setWidth(900).setHeight(360).setBackgroundColor('white');
  qc.setConfig({
    type: 'bar',
    data: {
      labels: pairs.map((p) => p.label),
      datasets: [
        { label: 'Promised (USD M)', data: pairs.map((p) => p.promised) },
        { label: 'Delivered (USD M)', data: pairs.map((p) => p.delivered) },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });

  // Fetch image and write to disk
  const imgUrl = await qc.getUrl();
  const resp = await fetch(imgUrl);
  if (!resp.ok) return { filePath: null, urlPath: null };
  const ab = await resp.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(ab));
  return { filePath, urlPath };
}


