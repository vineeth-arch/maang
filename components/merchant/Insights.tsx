'use client';

import { merchantHref, merchantRead } from '@/lib/demo';
import { KeyError } from './KeyError';

import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { formatINR } from '@/lib/domain/format';
import { TIER_INFO, type ItemInsight } from '@/lib/insights-entry';
import type { InsightsResponse } from '@/lib/server/insights';

const REC: Record<ItemInsight['recommendation'], { text: string; cls: string }> = {
  restock_now: { text: 'Restock now', cls: 'border-rising bg-rising text-white' },
  watch: { text: 'Watch', cls: 'border-insights-amber/30 bg-insights-amber-soft text-[#8F5500]' },
  skip: { text: 'Skip', cls: 'border-insights-border bg-insights-canvas text-insights-muted' },
};
const TREND = {
  rising: { label: '↑ Rising', cls: 'bg-insights-green-soft text-rising-text' },
  steady: { label: '→ Steady', cls: 'bg-insights-canvas text-insights-muted' },
  falling: { label: '↓ Falling', cls: 'bg-insights-coral-soft text-[#B83A3A]' },
} as const;
const hourLabel = (h: number | null) => (h === null ? '–' : `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}`);

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 min-w-0">
      <h2 className="font-display text-2xl font-semibold text-insights-ink sm:text-3xl">{title}</h2>
      {hint && <p className="label-mono mt-1 text-insights-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bars({ data, label, marks, tone = 'teal', compact }: { data: { x: string; n: number }[]; label: string; marks?: { at: number; name: string }[]; tone?: 'teal' | 'cobalt' | 'rose'; compact?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const w = 10;
  const H = 100;
  const fill = tone === 'teal' ? 'var(--insights-teal)' : tone === 'cobalt' ? 'var(--insights-cobalt)' : 'var(--insights-rose)';
  return (
    <figure>
      <svg role="img" aria-label={label} viewBox={`0 0 ${data.length * w} ${H + 14}`} className={`${compact ? 'h-24' : 'h-40'} w-full`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = (d.n / max) * H;
          return (
            <rect key={d.x} x={i * w + 1} y={H - h} width={w - 2} height={h} fill={fill} rx={1}>
              <title>{`${d.x}: ${d.n}`}</title>
            </rect>
          );
        })}
        {marks?.map((m) => (
          <line key={m.name} x1={m.at * w + w / 2} x2={m.at * w + w / 2} y1={0} y2={H} stroke="var(--insights-saffron)" strokeDasharray="3 2" strokeWidth={1.5} />
        ))}
      </svg>
      <figcaption className="label-mono mt-1 flex justify-between text-insights-muted">
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

export function Insights({ shop, k, demo = false }: { shop: string; k: string; demo?: boolean }) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [store, setStore] = useState('all');
  const [say, setSay] = useState<string | null>(null);

  useEffect(() => {
    api<InsightsResponse>(merchantRead(shop, 'insights', demo), k)
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'error'));
  }, [shop, k, demo]);

  const ins = data?.insights;
  const items = useMemo(() => {
    if (!ins) return [];
    if (store === 'all') return ins.items;
    return ins.items.filter((i) => i.by_store?.some((s) => s.store_id === store));
  }, [ins, store]);

  if (!demo && (!k.trim() || err === 'unauthorized')) return <KeyError missing={!k.trim()} />;
  if (err) return <main className="min-h-screen bg-insights-canvas p-6 text-insights-ink"><p className="text-xl">Could not load insights ({err}).</p></main>;
  if (!data || !ins) return <main className="min-h-screen bg-insights-canvas p-6 text-insights-ink"><p className="label-mono text-insights-muted">Loading…</p></main>;

  const moduleAliases: Record<string, string[]> = {
    location_filter: ['by_location', 'location_matrix'],
    table: ['full_table'],
    daily: ['daily_chart'],
    hourly: ['hourly_chart'],
    matrix: ['location_matrix'],
  };
  const has = (m: string) => data.modules.includes(m) || (moduleAliases[m] ?? []).some((alias) => data.modules.includes(alias));
  const q = `?k=${encodeURIComponent(k)}`;
  const stores = ins.byStore ?? [];
  const atStore = (i: ItemInsight) => (store === 'all' ? i.requests_30d : i.by_store?.find((s) => s.store_id === store)?.requests_30d ?? 0);

  async function speak() {
    if (demo) return;
    setSay('Playing…');
    // Create the audio element during the click so Safari/iOS keep user-gesture permission.
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

  const nextEv = ins.upcoming.find((u) => u.days_away > 0 && u.days_away <= 10);
  const ahead = Array.from({ length: nextEv?.days_away ?? 0 }, (_, i) => {
    const d = new Date(Date.parse(ins.daily[ins.daily.length - 1].date) + (i + 1) * 86_400_000).toISOString().slice(0, 10);
    return { x: d.slice(5), n: 0 };
  });
  const dailyBars = [...ins.daily.map((d) => ({ x: d.date.slice(5), n: d.count })), ...ahead];
  const marks = nextEv ? [{ at: dailyBars.length - 1, name: nextEv.name }] : [];

  return (
    <main className="min-h-screen bg-insights-canvas px-4 py-6 text-insights-ink sm:px-8 sm:py-8 xl:px-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label-mono text-insights-muted">03 / Insights · {TIER_INFO[data.profile.tier].label}</p>
          <h1 className="font-display mt-1 break-words text-3xl font-bold leading-none tracking-tight sm:text-5xl">{data.shop.name}</h1>
        </div>
        <nav className="flex flex-wrap gap-3">
          <a href={merchantHref(shop, k, 'board', demo)} className="label-mono flex min-h-12 items-center rounded-lg border border-insights-border bg-insights-surface px-4 text-insights-ink shadow-insights-card transition-colors hover:border-insights-teal hover:text-insights-teal">Board</a>
          <a href={merchantHref(shop, k, 'settings', demo)} className="label-mono flex min-h-12 items-center rounded-lg border border-insights-border bg-insights-surface px-4 text-insights-ink shadow-insights-card transition-colors hover:border-insights-teal hover:text-insights-teal">Who are you?</a>
        </nav>
      </header>

      <section aria-label="Headline" className="mt-7 rounded-insights-card border border-insights-teal/15 border-l-4 border-l-insights-teal bg-insights-teal-soft p-4 sm:p-6">
        <p className="font-display text-xl font-semibold leading-snug text-insights-ink sm:text-3xl" data-testid="headline">{ins.headline}</p>
        <button type="button" disabled={demo} onClick={() => void speak()} className="disabled:cursor-not-allowed disabled:opacity-40 label-mono mt-4 min-h-12 rounded-lg bg-insights-teal px-5 text-white shadow-insights-card transition-colors hover:bg-insights-ink focus-visible:outline-insights-teal">
          Soundbox par suno
        </button>
        {say && <p role="status" className="label-mono mt-2 text-insights-muted">{say}</p>}
      </section>

      <Section title="Coming up" hint="Festivals and sales in the next 45 days">
        <ul className="flex gap-3 overflow-x-auto pb-2">
          {ins.upcoming.map((u, index) => (
            <li key={u.id} className={`min-w-40 shrink-0 rounded-insights-card border p-3.5 shadow-insights-card ${index === 0 ? 'border-insights-saffron/35 bg-insights-saffron-soft' : 'border-insights-border bg-insights-surface'}`}>
              <p className="font-display text-lg font-semibold text-insights-ink">{u.name}</p>
              <p className="label-mono mt-1 text-[#8F5500]">{u.days_away === 0 ? 'Today' : `In ${u.days_away} days`}</p>
            </li>
          ))}
          {ins.upcoming.length === 0 && <li className="text-insights-muted">No festivals or sales soon.</li>}
        </ul>
      </Section>

      {(has('location_filter') || has('by_location') || has('matrix')) && stores.length > 0 && (
        <div className="mt-8">
          <label className="label-mono block text-insights-muted" htmlFor="loc">Location</label>
          <select id="loc" value={store} onChange={(e) => setStore(e.target.value)} className="mt-1 min-h-12 rounded-lg border border-insights-border bg-insights-surface px-3 text-insights-ink shadow-insights-card focus-visible:outline-insights-teal">
            <option value="all">All locations</option>
            {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_label}</option>)}
          </select>
        </div>
      )}

      <Section title="What to stock" hint="Top items by demand. Rules, not AI.">
        <ul className="space-y-3">
          {items.slice(0, 5).map((i) => (
            <li key={i.item_key} data-item={i.item_key} data-rec={i.recommendation} className="rounded-insights-card border border-insights-border bg-insights-surface p-4 shadow-insights-card sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-xl font-semibold text-insights-ink sm:text-2xl">{i.item_label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-insights-muted">{i.reason}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`label-mono rounded-full border px-3 py-1.5 ${TREND[i.trend].cls}`}>{TREND[i.trend].label}</span>
                  <span className={`label-mono rounded-full border px-3 py-1.5 ${REC[i.recommendation].cls}`}>{REC[i.recommendation].text}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-insights-border pt-3 sm:grid-cols-4">
                <div>
                  <p className="label-mono text-insights-muted">Asked · 7 days</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-insights-teal">{i.requests_7d}<span className="ml-1 text-sm font-normal text-insights-muted">people</span></p>
                </div>
                <div>
                  <p className="label-mono text-insights-muted">Asked · 30 days</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-insights-ink">{atStore(i)}</p>
                </div>
                <div>
                  <p className="label-mono text-insights-muted">Median budget</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-insights-ink">{i.budget_median_inr === null ? '–' : formatINR(i.budget_median_inr)}</p>
                </div>
                <div>
                  <p className="label-mono text-insights-muted">Peak ask time</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-insights-ink">{hourLabel(i.peak_hour)}</p>
                </div>
              </div>
              {i.urgent_lost > 0 && (
                <p className="label-mono mt-3 inline-flex rounded-full border border-insights-coral/20 bg-insights-coral-soft px-3 py-1.5 text-[#B83A3A]">
                  {i.urgent_lost} urgent {i.urgent_lost === 1 ? 'request' : 'requests'} lost
                </p>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {has('table') && (
        <Section title="All items" hint="Last 7 and 30 days">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] overflow-hidden rounded-insights-card border border-insights-border bg-insights-surface text-left shadow-insights-card">
              <thead className="label-mono bg-insights-teal-soft text-insights-muted">
                <tr>
                  <th className="px-3 py-3">Item</th><th className="pr-3">7 days</th><th className="pr-3">{store === 'all' ? '30 days' : '30 days here'}</th><th className="pr-3">Trend</th>
                  <th className="pr-3">Median budget</th><th className="pr-3">Demand value</th><th className="pr-3">Event</th><th className="pr-3">Do</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.item_key} className="border-t border-insights-border text-sm">
                    <td className="px-3 py-3 font-medium text-insights-ink">{i.item_label}</td>
                    <td className="pr-3">{i.requests_7d}</td>
                    <td className="pr-3">{atStore(i)}</td>
                    <td className="pr-3"><span className={`label-mono rounded-full px-2 py-1 ${TREND[i.trend].cls}`}>{TREND[i.trend].label}</span></td>
                    <td className="pr-3">{i.budget_median_inr === null ? '–' : formatINR(i.budget_median_inr)}</td>
                    <td className="pr-3">{formatINR(i.demand_value_inr)}</td>
                    <td className="pr-3">{i.events[0] ? <span className="rounded-full bg-insights-saffron-soft px-2 py-1 text-[#8F5500]">{i.events[0].name} ({i.events[0].days_away}d)</span> : '–'}</td>
                    <td className="pr-3"><span className={`label-mono rounded-full border px-2 py-1 ${REC[i.recommendation].cls}`}>{REC[i.recommendation].text}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {has('csv') && (
            <button type="button" onClick={download} className="label-mono mt-3 min-h-12 rounded-lg border border-insights-border bg-insights-surface px-4 text-insights-ink transition-colors hover:border-insights-teal hover:text-insights-teal">Download CSV</button>
          )}
        </Section>
      )}

      {has('daily') && (
        <Section title="Requests per day" hint={`Last 30 days${nextEv ? `. Dashed line: ${nextEv.name}` : ''}`}>
          <Bars label={`Requests per day, last 30 days${nextEv ? `, then days until ${nextEv.name}` : ''}`} data={dailyBars} marks={marks} tone="teal" compact={data.profile.tier === 'small'} />
        </Section>
      )}

      {has('hourly') && (
        <Section title="Requests by hour" hint="When people ask, last 30 days">
          <Bars label="Requests by hour of day" data={ins.hourly.map((h) => ({ x: hourLabel(h.hour), n: h.count }))} tone="rose" />
        </Section>
      )}

      {has('by_location') && stores.length > 0 && (
        <Section title="By location" hint="Requests in 30 days">
          <ul className="space-y-2">
            {stores.map((s) => (
              <li key={s.store_id}>
                <p className="label-mono text-insights-muted">{s.store_label}: <span className="font-semibold text-[#3A64B5]">{s.count}</span></p>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-insights-canvas">
                  <div className="h-full rounded-full bg-insights-cobalt" style={{ width: `${(s.count / Math.max(...stores.map((x) => x.count))) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {has('matrix') && stores.length > 0 && (
        <Section title="Item by location" hint="Requests in 30 days">
          <div className="overflow-x-auto">
            <table data-testid="matrix" className="w-full min-w-[480px] overflow-hidden rounded-insights-card border border-insights-border bg-insights-surface text-left shadow-insights-card">
              <thead className="label-mono bg-insights-teal-soft text-insights-muted">
                <tr><th className="px-3 py-3 pr-3">Item</th>{stores.map((s) => <th key={s.store_id} className="pr-3">{s.store_label}</th>)}</tr>
              </thead>
              <tbody>
                {ins.items.map((i) => (
                  <tr key={i.item_key} className="border-t border-insights-border text-sm">
                    <td className="px-3 py-3 pr-3 font-medium text-insights-ink">{i.item_label}</td>
                    {stores.map((s) => <td key={s.store_id} className="pr-3">{i.by_store?.find((b) => b.store_id === s.store_id)?.requests_30d ?? 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1">
            {ins.items.filter((i) => i.by_store?.length).map((i) => (
            <li key={i.item_key} className="text-sm text-insights-muted">{i.item_label}: most demand at <span className="font-semibold text-insights-ink">{i.by_store![0].store_label}</span> ({i.by_store![0].requests_30d} requests).</li>
            ))}
          </ul>
        </Section>
      )}

      <footer className="label-mono mt-10 border-t border-insights-border pt-4 text-insights-muted">
        Demand data is synthetic for the demo. Recommendations are rules, not AI.
      </footer>
    </main>
  );
}
