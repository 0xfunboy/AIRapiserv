import { AdminClient } from '../../components/AdminClient';

export default function AdminPage() {

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Admin & Overrides</h2>
        <p className="text-sm text-slate-400">Manage mappings, watchlists, and fallback policy</p>
      </div>
      <AdminClient />
    </section>
  );
}
