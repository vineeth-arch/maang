import type { Metadata } from 'next';
import { DEMO_READ_ONLY } from '@/lib/demo';
export const metadata: Metadata = { title: 'MAANG Demo', robots: { index: false, follow: false } };
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <><header className="border-b border-board-fg/20 bg-board-bg px-4 py-4 text-board-fg sm:px-8">
    <p className="font-display text-xl font-bold">Demo view, synthetic data</p>
    <p className="mt-1 text-sm">{DEMO_READ_ONLY}</p>
  </header>{children}</>;
}
