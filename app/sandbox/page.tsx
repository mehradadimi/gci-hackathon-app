import { GciBadge } from '@/src/components/GciBadge';
import { MetricChips } from '@/src/components/MetricChips';
import { SourceLinks } from '@/src/components/SourceLinks';

export default function SandboxPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <section>
        <h2 className="text-xl font-semibold">GciBadge</h2>
        <div className="mt-3 flex gap-3">
          <GciBadge score={85} />
          <GciBadge score={70} />
          <GciBadge score={40} />
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold">MetricChips</h2>
        <div className="mt-3">
          <MetricChips flags={["hedges high", "uncertainty medium", "negations low"]} />
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold">SourceLinks</h2>
        <div className="mt-3">
          <SourceLinks filingUrl="https://www.sec.gov" transcriptUrl="https://www.fool.com" />
        </div>
      </section>
    </main>
  );
}


