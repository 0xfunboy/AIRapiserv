interface Props {
  title: string;
  value: string;
  subtitle?: string;
}

export function StatCard({ title, value, subtitle }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-full">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
