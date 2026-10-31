'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import { TIER_INFO, tierFor, type Tier } from '@/lib/insights-entry';
import { BANDS, type BandId } from '@/lib/tier-bands';
import type { InsightsResponse, Profile } from '@/lib/server/insights';

const WHO: Record<Tier, { who: string; when: string; outcome: string }> = {
  small: { who: 'The owner, at the counter', when: 'Once a day, before the wholesale trip', outcome: 'One line on what to buy, read out on the Soundbox' },
  medium: { who: 'Owner or store manager', when: 'Weekly buying meeting', outcome: 'Full item table, day and hour charts, a CSV for the distributor' },
  large: { who: 'Category or purchase manager', when: 'Weekly, per location', outcome: 'Demand split by location, so stock goes where people ask' },
  very_large: { who: 'Central buying team for a chain', when: 'Weekly planning and before every festival', outcome: 'Item by branch matrix and the branch with most demand for each item' },
};

const MODULE_LABEL: Record<string, string> = {
  headline: 'Headline on Soundbox', events: 'Festival strip', top_items: 'What to stock', table: 'Full table', daily: 'Requests per day',
  hourly: 'Requests by hour', csv: 'CSV export', by_location: 'By location', location_filter: 'Location filter', matrix: 'Item by location', top_branch: 'Top branch per item',
};

export function WhoAreYou({ shop, k }: { shop: string; k: string }) {
  const [band, setBand] = useState<BandId>('under_40l');
  const [locations, setLocations] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const base = `/api/merchant/${encodeURIComponent(shop)}`;

  useEffect(() => {
    api<InsightsResponse>(`${base}/insights`, k)
      .then((d) => {
        setBand(d.profile.annual_revenue_band);
        setLocations(d.profile.locations);
      })
      .catch(() => setMsg('Could not load your current size.'));
  }, [base, k]);

  const tier = tierFor(BANDS.find((b) => b.id === band)?.value ?? 0, locations);
  const info = TIER_INFO[tier];
  const w = WHO[tier];

  async function save() {
    try {
      await api<Profile>(`${base}/profile`, k, { annual_revenue_band: band, locations });
      setMsg('Saved. Insights now show this view.');
    } catch {
      setMsg('Could not save. Try again.');
    }
  }

  return (
    <main className="min-h-screen bg-board-bg px-4 py-6 text-board-fg sm:px-8">
      <p className="label-mono text-board-fg/70">SETTINGS</p>
      <h1 className="font-display mt-1 text-3xl font-bold sm:text-5xl">Who are you?</h1>
      <fieldset className="mt-6">
        <legend className="label-mono text-board-fg/80">Turnover</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {BANDS.map((b) => (
            <label key={b.id} className="flex min-h-12 items-center gap-3 rounded-md border border-board-fg/40 px-3">
              <input type="radio" name="band" checked={band === b.id} onChange={() => setBand(b.id)} />
              {b.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="label-mono mt-6 block text-board-fg/80" htmlFor="locs">Number of locations</label>
      <input id="locs" type="number" min={1} max={5000} value={locations} onChange={(e) => setLocations(Math.max(1, parseInt(e.target.value, 10) || 1))}
        className="mt-1 min-h-12 w-32 rounded-md border border-board-fg/40 bg-board-bg px-3 text-board-fg" />

      <section className="mt-6 rounded-lg border border-board-fg/30 p-4" aria-live="polite">
        <p className="font-display text-2xl font-semibold">{info.label}</p>
        <p className="label-mono text-board-fg/80">{info.band}</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          <div><dt className="label-mono text-board-fg/80">Who uses it</dt><dd>{w.who}</dd></div>
          <div><dt className="label-mono text-board-fg/80">When</dt><dd>{w.when}</dd></div>
          <div><dt className="label-mono text-board-fg/80">Outcome</dt><dd>{w.outcome}</dd></div>
        </dl>
        <p className="label-mono mt-3 text-board-fg/80">You get</p>
        <p>{info.modules.map((m) => MODULE_LABEL[m] ?? m).join(' · ')}</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => void save()} className="label-mono min-h-12 rounded-md bg-board-fg px-4 text-board-bg">Save</button>
        <a href={`/m/${encodeURIComponent(shop)}/insights?k=${encodeURIComponent(k)}`} className="label-mono flex min-h-12 items-center rounded-md border border-board-fg/40 px-4">Back to insights</a>
      </div>
      {msg && <p role="status" className="mt-3">{msg}</p>}
    </main>
  );
}
