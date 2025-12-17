import { CompareClient } from '../../components/CompareClient';

export default function ComparePage() {

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Compare</h2>
        <p className="text-sm text-slate-400">Price divergence across venues for any token</p>
      </div>
      <CompareClient />
    </section>
  );
}
