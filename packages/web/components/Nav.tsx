'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/status', label: 'Status' },
  { href: '/tokens', label: 'Tokens' },
  { href: '/assets', label: 'Resolve' },
  { href: '/markets', label: 'Markets' },
  { href: '/charts', label: 'Charts' },
  { href: '/compare', label: 'Compare' },
  { href: '/token', label: 'Token Terminal' },
  { href: '/admin', label: 'Admin' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-4 text-sm">
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md font-medium ${active ? 'bg-emerald-500 text-slate-900' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
