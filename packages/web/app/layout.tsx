import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import { Nav } from '../components/Nav';

export const metadata: Metadata = {
  title: 'AIRapiserv',
  description: 'AIR Track data gateway',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-800 bg-slate-950/80 sticky top-0 backdrop-blur">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex flex-col gap-3">
              <div>
                <h1 className="text-lg font-semibold">AIRapiserv</h1>
                <p className="text-xs text-slate-400">Unified market data gateway</p>
              </div>
              <Nav />
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
