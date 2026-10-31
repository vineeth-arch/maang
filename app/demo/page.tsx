import Link from 'next/link';
import { DEMO_STORES } from '@/lib/demo';
const views = [ ['board', 'Board', 'See requests, matching stock and demand clusters.'], ['insights', 'Insights', 'Explore demand trends, festivals and restock recommendations.'], ['settings', 'Settings', 'Preview how turnover and locations shape the merchant experience.'] ] as const;
export default function DemoPage() {
  return <main className="min-h-screen bg-board-bg p-4 text-board-fg sm:p-8">
    <h1 className="font-display text-4xl font-bold">Explore MAANG</h1>
    <p className="mt-3">Two synthetic stores. No merchant key needed.</p>
    <nav aria-label="Demo views" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Object.keys(DEMO_STORES).flatMap(store => views.map(([path, title, description]) =>
        <Link prefetch={false} key={`${store}/${path}`} href={`/demo/${store}/${path}`} className="rounded-xl border border-board-fg/30 p-5">
          <h2 className="text-xl font-semibold">{store === 'toys' ? 'Toys' : 'Electronics'} · {title}</h2><p className="mt-2">{description}</p>
        </Link>))}
      <Link prefetch={false} href="/demo" className="rounded-xl border border-board-fg/30 p-5"><h2 className="text-xl font-semibold">Demo overview</h2><p className="mt-2">Start here and choose a store and view for your walkthrough.</p></Link>
    </nav>
  </main>;
}
