import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Board } from '@/components/merchant/Board';
import { Insights } from '@/components/merchant/Insights';
import { WhoAreYou } from '@/components/merchant/WhoAreYou';
import { demoSlug } from '@/lib/demo';
export default async function DemoPage({ params }: { params: Promise<{ store: string; view: string }> }) {
  const { store, view } = await params;
  const shop = demoSlug(store);
  if (!shop || !['board', 'insights', 'settings'].includes(view)) notFound();
  const other = store === 'toys' ? 'electronics' : 'toys';
  return <>
    <nav aria-label="Demo navigation" className="flex flex-wrap gap-3 border-b border-board-fg/20 bg-board-bg px-4 py-3 text-board-fg sm:px-8">
      {['board', 'insights', 'settings'].map(v => <Link prefetch={false} key={v} aria-current={v === view ? 'page' : undefined} className="rounded border border-board-fg/30 px-3 py-2 capitalize" href={`/demo/${store}/${v}`}>{v}</Link>)}
      <Link prefetch={false} className="px-3 py-2" href={`/demo/${other}/${view}`}>{other === 'toys' ? 'Toys store' : 'Electronics store'}</Link>
      <Link prefetch={false} className="px-3 py-2" href={`/s/${shop}`}>Customer page</Link>
      <Link prefetch={false} className="px-3 py-2" href="/demo">Back to /demo</Link>
    </nav>
    {view === 'board' ? <Board shop={shop} k="" demo /> : view === 'insights' ? <Insights shop={shop} k="" demo /> : <WhoAreYou shop={shop} k="" demo />}
  </>;
}
