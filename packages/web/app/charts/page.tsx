import { ChartsClient } from '../../components/ChartsClient';

export default async function ChartsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Charts</h2>
        <p className="text-sm text-slate-400">Rolling candles across sources (live data)</p>
      </div>
      <ChartsClient />
    </section>
  );
}
