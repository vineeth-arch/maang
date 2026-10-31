'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { formatINR } from '@/lib/domain/format';
import { TIER_INFO, type ItemInsight } from '@/lib/insights-entry';
import type { InsightsResponse } from '@/lib/server/insights';

const REC: Record<ItemInsight['recommendation'], { text: string; cls: string }> = {
  restock_now: { text: 'Restock now', cls: 'bg-board-fg text-board-bg border-board-fg' },
  watch: { text: 'Watch', cls: 'border-board-fg text-board-fg' },
  skip: { text: 'Skip', cls: 'border-dashed border-board-fg/60 text-board-fg/80' },
};
const ARROW = { rising: '↑ rising', steady: '→ steady', falling: '↓ falling' } as const;
const hourLabel = (h: number | null) => (h === null ? '–' : `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}`);

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 min-w-0">
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
      {hint && <p className="label-mono mt-1 text-board-fg/70">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bars({ data, label, marks, compact }: { data: { x: string; n: number }[]; label: string; marks?: { at: number; name: string }[]; compact?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const w = 10;
  const H = 100;
  return (
    <figure>
      <svg role="img" aria-label={label} viewBox={`0 0 ${data.length * w} ${H + 14}`} className={`${compact ? 'h-24' : 'h-40'} w-full`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = (d.n / max) * H;
          return (
            <rect key={d.x} x={i * w + 1} y={H - h} width={w - 2} height={h} fill="currentColor">
              <title>{`${d.x}: ${d.n}`}</title>
            </rect>
          );
        })}
        {marks?.map((m) => (
          <line key={m.name} x1={m.at * w + w / 2} x2={m.at * w + w / 2} y1={0} y2={H} stroke="currentColor" strokeDasharray="3 2" strokeWidth={1} />
        ))}
      </svg>
      <figcaption className="label-mono mt-1 flex justify-between text-board-fg/70">
        <span>{data[0]?.x}</span>
        <span>{data[data.length - 1]?.x}</span>
      </figcaption>
    </figure>
  );
}

function csv(items: ItemInsight[]): string {
  const head = ['item', 'category', 'requests_7d', 'requests_prev_7d', 'requests_30d', 'trend', 'median_budget_inr', 'demand_value_inr', 'event', 'recommendation', 'reason'];
  // Leading = + - @ would run as a formula in Excel.
  const esc = (v: unknown) => {
    const t = String(v ?? '');
    return `"${(/^[=+\-@]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
  };
  const rows = items.map((i) => [i.item_label, i.category, i.requests_7d, i.requests_prev_7d, i.requests_30d, i.trend, i.budget_median_inr, i.demand_value_inr, i.events[0]?.name, i.recommendation, i.reason].map(esc).join(','));
  return [head.join(','), ...rows].join('\n');
}

export function Insights({ shop, k }: { shop: string; k: string }) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [store, setStore] = useState('all');
  const [say, setSay] = useState<string | null>(null);

  useEffect(() => {
    api<InsightsResponse>(`/api/merchant/${encodeURIComponent(shop)}/insights`, k)
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'error'));
  }, [shop, k]);

  const ins = data?.insights;
  const items = useMemo(() => {
    if (!ins) return [];
    if (store === 'all') return ins.items;
    return ins.items.filter((i) => i.by_store?.some((s) => s.store_id === store));
  }, [ins, store]);

  if (err) return <main className="min-h-screen bg-board-bg p-6 text-board-fg"><p className="text-xl">Could not load insights ({err}).</p></main>;
  if (!data || !ins) return <main className="min-h-screen bg-board-bg p-6 text-board-fg"><p className="label-mono">Loading…</p></main>;

  const has = (m: string) => data.modules.includes(m);
  const q = `?k=${encodeURIComponent(k)}`;
  const base = `/m/${encodeURIComponent(shop)}`;
  const stores = ins.byStore ?? [];
  const atStore = (i: ItemInsight) => (store === 'all' ? i.requests_30d : i.by_store?.find((s) => s.store_id === store)?.requests_30d ?? 0);

  async function speak() {
    setSay('Playing…');
    // Created inside the click so Safari/iOS keep the user-gesture permission to play.
    const a = new Audio();
    try {
      const r = await fetch(`/api/merchant/${encodeURIComponent(shop)}/speak${q}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'insight' }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const url = URL.createObjectURL(await r.blob());
      a.src = url;
      a.onended = () => URL.revokeObjectURL(url);
      await a.play();
      setSay(null);
    } catch {
      setSay('Soundbox voice is not available right now.');
    }
  }

  function download() {
    const blob = new Blob([csv(items)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shop}-insights.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Daily chart runs past today up to the next festival within 10 days, marked with a dashed line.
  const nextEv = ins.upcoming.find((u) => u.days_away > 0 && u.days_away <= 10);
  const ahead = Array.from({ length: nextEv?.days_away ?? 0 }, (_, i) => {
    const d = new Date(Date.parse(ins.daily[ins.daily.length - 1].date) + (i + 1) * 86_400_000).toISOString().slice(0, 10);
    return { x: d.slice(5), n: 0 };
  });
  const dailyBars = [...ins.daily.map((d) => ({ x: d.date.slice(5), n: d.count })), ...ahead];
  const marks = nextEv ? [{ at: dailyBars.length - 1, name: nextEv.name }] : [];

  return (
    <main className="min-h-screen bg-board-bg px-4 py-6 text-board-fg sm:px-8 xl:px-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label-mono text-board-fg/70">03 / INSIGHTS · {TIER_INFO[data.profile.tier].label}</p>
          <h1 className="font-display mt-1 break-words text-3xl font-bold leading-none sm:text-5xl">{data.shop.name}</h1>
        </div>
        <nav className="flex flex-wrap gap-3">
          <a href={`${base}${q}`} className="label-mono flex min-h-12 items-center rounded-md border border-board-fg/40 px-4">Board</a>
          <a href={`${base}/settings${q}`} className="label-mono flex min-h-12 items-center rounded-md border border-board-fg/40 px-4">Who are you?</a>
        </nav>
      </header>

      <section aria-label="Headline" className="mt-6 border-l-4 border-board-fg pl-4">
        <p className="font-display text-2xl font-semibold sm:text-3xl" data-testid="headline">{ins.headline}</p>
        <button type="button" onClick={() => void speak()} className="label-mono mt-3 min-h-12 rounded-md border border-board-fg/60 px-4">
          Soundbox par suno
        </button>
        {say && <p role="status" className="label-mono mt-2 text-board-fg/80">{say}</p>}
      </section>

      <Section title="Coming up" hint="Festivals and sales in the next 45 days">
        <ul className="flex gap-3 overflow-x-auto pb-2">
          {ins.upcoming.map((u) => (
            <li key={u.id} className="min-w-36 shrink-0 rounded-lg border border-board-fg/30 p-3">
              <p className="font-display text-xl font-semibold">{u.name}</p>
              <p className="label-mono text-board-fg/80">{u.days_away === 0 ? 'today' : `in ${u.days_away} days`}</p>
            </li>
          ))}
          {ins.upcoming.length === 0 && <li className="text-board-fg/70">No festivals or sales soon.</li>}
        </ul>
      </Section>

      {has('location_filter') && stores.length > 0 && (
        <div className="mt-8">
          <label className="label-mono block text-board-fg/80" htmlFor="loc">Location</label>
          <select id="loc" value={store} onChange={(e) => setStore(e.target.value)} className="mt-1 min-h-12 max-w-full rounded-md border border-board-fg/40 bg-board-bg px-3 text-board-fg">
            <option value="all">All locations</option>
            {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_label}</option>)}
          </select>
        </div>
      )}

      <Section title="What to stock" hint="Top items by demand. Rules, not AI.">
        <ul className="space-y-3">
          {items.slice(0, 5).map((i) => (
            <li key={i.item_key} data-item={i.item_key} data-rec={i.recommendation} className="rounded-lg border border-board-fg/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-xl font-semibold">{i.item_label}</p>
                <span className={`label-mono rounded-full border-2 px-3 py-1 ${REC[i.recommendation].cls}`}>{REC[i.recommendation].text}</span>
              </div>
              <p className="mt-1">{i.reason}</p>
            </li>
          ))}
        </ul>
      </Section>

      {has('table') && (
        <Section title="All items" hint="Last 7 and 30 days">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="label-mono text-board-fg/80">
                <tr>
                  <th className="py-2 pr-3">Item</th><th className="pr-3">7 days</th><th className="pr-3">{store === 'all' ? '30 days' : '30 days here'}</th><th className="pr-3">Trend</th>
                  <th className="pr-3">Median budget</th><th className="pr-3">Demand value</th><th className="pr-3">Event</th><th>Do</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.item_key} className="border-t border-board-fg/20">
                    <td className="py-2 pr-3">{i.item_label}</td>
                    <td className="pr-3">{i.requests_7d}</td>
                    <td className="pr-3">{atStore(i)}</td>
                    <td className="pr-3">{ARROW[i.trend]}</td>
                    <td className="pr-3">{i.budget_median_inr === null ? '–' : formatINR(i.budget_median_inr)}</td>
                    <td className="pr-3">{formatINR(i.demand_value_inr)}</td>
                    <td className="pr-3">{i.events[0] ? `${i.events[0].name} (${i.events[0].days_away}d)` : '–'}</td>
                    <td>{REC[i.recommendation].text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {has('csv') && (
            <button type="button" onClick={download} className="label-mono mt-3 min-h-12 rounded-md border border-board-fg/60 px-4">Download CSV</button>
          )}
        </Section>
      )}

      {has('daily') && (
        <Section title="Requests per day" hint={`Last 30 days${nextEv ? `. Dashed line: ${nextEv.name}` : ''}`}>
          <Bars label={`Requests per day, last 30 days${nextEv ? `, then days until ${nextEv.name}` : ''}`} data={dailyBars} marks={marks} compact={data.profile.tier === 'small'} />
        </Section>
      )}

      {has('hourly') && (
        <Section title="Requests by hour" hint="When people ask, last 30 days">
          <Bars label="Requests by hour of day" data={ins.hourly.map((h) => ({ x: hourLabel(h.hour), n: h.count }))} />
        </Section>
      )}

      {has('by_location') && stores.length > 0 && (
        <Section title="By location" hint="Requests in 30 days">
          <ul className="space-y-2">
            {stores.map((s) => (
              <li key={s.store_id}>
                <p className="label-mono">{s.store_label}: {s.count}</p>
                <div className="h-4 bg-board-fg" style={{ width: `${(s.count / Math.max(...stores.map((x) => x.count))) * 100}%` }} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {has('matrix') && stores.length > 0 && (
        <Section title="Item by location" hint="Requests in 30 days">
          <div className="overflow-x-auto">
            <table data-testid="matrix" className="w-full min-w-[480px] text-left">
              <thead className="label-mono text-board-fg/80">
                <tr><th className="py-2 pr-3">Item</th>{stores.map((s) => <th key={s.store_id} className="pr-3">{s.store_label}</th>)}</tr>
              </thead>
              <tbody>
                {ins.items.map((i) => (
                  <tr key={i.item_key} className="border-t border-board-fg/20">
                    <td className="py-2 pr-3">{i.item_label}</td>
                    {stores.map((s) => <td key={s.store_id} className="pr-3">{i.by_store?.find((b) => b.store_id === s.store_id)?.requests_30d ?? 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1">
            {ins.items.filter((i) => i.by_store?.length).map((i) => (
              <li key={i.item_key}>{i.item_label}: most demand at {i.by_store![0].store_label} ({i.by_store![0].requests_30d} requests).</li>
            ))}
          </ul>
        </Section>
      )}

      <footer className="label-mono mt-10 border-t border-board-fg/20 pt-4 text-board-fg/80">
        Demand data is synthetic for the demo. Recommendations are rules, not AI.
      </footer>
    </main>
  );
}
