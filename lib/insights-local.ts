// Temporary local copy of the lib/insights interface until Codex's version lands on origin/voice.
// Import only through lib/insights-entry.ts.

export type Tier = 'small' | 'medium' | 'large' | 'very_large';
export type DemandEvent = { item_key: string; item_label: string; category: string | null; created_at: string; max_budget: number | null; urgent: boolean; status: string; store_id?: string | null; store_label?: string | null };
export type SeasonEvent = { id: string; name: string; date: string; window_days_before: number; categories: string[]; source: string };
export type UpcomingEvent = SeasonEvent & { days_away: number };
export type ItemInsight = { item_key: string; item_label: string; category: string | null; requests_7d: number; requests_prev_7d: number; requests_30d: number; urgent_lost: number; trend: 'rising' | 'steady' | 'falling'; demand_value_inr: number; budget_median_inr: number | null; peak_hour: number | null; events: { id: string; name: string; days_away: number }[]; recommendation: 'restock_now' | 'watch' | 'skip'; reason: string; by_store?: { store_id: string; store_label: string; requests_30d: number }[] };
export type Insights = { items: ItemInsight[]; daily: { date: string; count: number }[]; hourly: { hour: number; count: number }[]; byStore?: { store_id: string; store_label: string; count: number }[]; upcoming: UpcomingEvent[]; headline: string };

const SRC = 'Public Indian festival and sale calendar';
export function seasonCalendar(): SeasonEvent[] {
  return [
    { id: 'dhanteras-2026', name: 'Dhanteras', date: '2026-11-06', window_days_before: 14, categories: ['electronics', 'jewellery', 'kitchen'], source: SRC },
    { id: 'diwali-2026', name: 'Diwali', date: '2026-11-08', window_days_before: 21, categories: ['toys', 'gifts', 'electronics', 'sweets', 'decor'], source: SRC },
    { id: 'bhai-dooj-2026', name: 'Bhai Dooj', date: '2026-11-11', window_days_before: 10, categories: ['gifts', 'sweets'], source: SRC },
    { id: 'childrens-day-2026', name: "Children's Day", date: '2026-11-14', window_days_before: 10, categories: ['toys', 'books'], source: SRC },
    { id: 'black-friday-2026', name: 'Black Friday sale', date: '2026-11-27', window_days_before: 10, categories: ['electronics'], source: SRC },
    { id: 'christmas-2026', name: 'Christmas', date: '2026-12-25', window_days_before: 21, categories: ['toys', 'gifts', 'decor'], source: SRC },
    { id: 'new-year-2027', name: 'New Year', date: '2027-01-01', window_days_before: 10, categories: ['gifts', 'electronics'], source: SRC },
    { id: 'republic-day-sale-2027', name: 'Republic Day sale', date: '2027-01-26', window_days_before: 10, categories: ['electronics'], source: SRC },
  ];
}

const DAY = 86_400_000;
// IST calendar date for an instant.
function istDate(d: Date): string {
  return new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}
function istHour(d: Date): number {
  return new Date(d.getTime() + 5.5 * 3_600_000).getUTCHours();
}
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / DAY);
}

export function upcomingEvents(today: Date, horizonDays = 45): UpcomingEvent[] {
  const t = istDate(today);
  return seasonCalendar()
    .map((e) => ({ ...e, days_away: daysBetween(t, e.date) }))
    .filter((e) => e.days_away >= 0 && e.days_away <= horizonDays)
    .sort((a, b) => a.days_away - b.days_away);
}

export const TIER_INFO: Record<Tier, { label: string; band: string; modules: string[] }> = {
  small: { label: 'Small shop', band: 'Under ₹40 lakh a year, 1 location', modules: ['headline', 'events', 'top_items'] },
  medium: { label: 'Medium business', band: '₹40 lakh to ₹5 crore a year', modules: ['headline', 'events', 'top_items', 'table', 'daily', 'hourly', 'csv'] },
  large: { label: 'Large business', band: '₹5 crore to ₹50 crore a year, or 3+ locations', modules: ['headline', 'events', 'top_items', 'table', 'daily', 'hourly', 'csv', 'by_location', 'location_filter'] },
  very_large: { label: 'Very large chain', band: 'Above ₹50 crore a year, or 10+ locations', modules: ['headline', 'events', 'top_items', 'table', 'daily', 'hourly', 'csv', 'by_location', 'location_filter', 'matrix', 'top_branch'] },
};

export function tierFor(annualRevenueInr: number, locations: number): Tier {
  if (annualRevenueInr >= 50_00_00_000 || locations >= 10) return 'very_large';
  if (annualRevenueInr >= 5_00_00_000 || locations >= 3) return 'large';
  if (annualRevenueInr >= 40_00_000) return 'medium';
  return 'small';
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

const FULFILLED = new Set(['reserved', 'picked_up']);

export function buildInsights(events: DemandEvent[], opts: { today: Date; tier: Tier }): Insights {
  const now = opts.today.getTime();
  const todayISO = istDate(opts.today);
  const upcoming = upcomingEvents(opts.today);
  const multi = opts.tier === 'large' || opts.tier === 'very_large';

  const recent = events.filter((e) => {
    const age = now - Date.parse(e.created_at);
    return age >= 0 && age < 30 * DAY;
  });

  const groups = new Map<string, DemandEvent[]>();
  for (const e of recent) {
    const g = groups.get(e.item_key);
    if (g) g.push(e);
    else groups.set(e.item_key, [e]);
  }

  const items: ItemInsight[] = [];
  for (const [key, rows] of groups) {
    const age = (e: DemandEvent) => now - Date.parse(e.created_at);
    const r7 = rows.filter((e) => age(e) < 7 * DAY).length;
    const prev = rows.filter((e) => age(e) >= 7 * DAY && age(e) < 14 * DAY).length;
    const r30 = rows.length;
    const trend: ItemInsight['trend'] =
      r7 >= prev * 1.5 && r7 - prev >= 3 ? 'rising' : prev >= r7 * 1.5 && prev - r7 >= 2 ? 'falling' : 'steady';
    const budgets = rows.map((e) => e.max_budget).filter((b): b is number => b !== null && b > 0);
    const med = median(budgets);
    const hours = new Array(24).fill(0) as number[];
    for (const e of rows) hours[istHour(new Date(e.created_at))]++;
    const peak = r30 ? hours.indexOf(Math.max(...hours)) : null;
    const category = rows.find((e) => e.category)?.category ?? null;
    const linked = upcoming
      .filter((u) => category && u.categories.includes(category) && u.days_away <= u.window_days_before)
      .map((u) => ({ id: u.id, name: u.name, days_away: u.days_away }));
    // Most common label, so one odd customer phrasing doesn't rename the item.
    const counts = new Map<string, number>();
    for (const e of rows) counts.set(e.item_label, (counts.get(e.item_label) ?? 0) + 1);
    const label = [...counts].sort((a, b) => b[1] - a[1])[0][0];

    let recommendation: ItemInsight['recommendation'];
    let reason: string;
    const ev = linked[0];
    if (r30 <= 1) {
      recommendation = 'skip';
      reason = `Only ${r30} request in 30 days. Not enough demand to stock.`;
    } else if ((trend === 'rising' && r7 >= 5) || (ev && r7 >= 3)) {
      recommendation = 'restock_now';
      reason = `${r7} people asked in the last 7 days${prev ? ` (up from ${prev})` : ''}${ev ? `, ${ev.name} is ${ev.days_away} days away` : ''}. Stock up now.`;
    } else {
      recommendation = 'watch';
      reason = `${r7} requests this week, ${prev} the week before. Keep an eye on it.`;
    }

    const item: ItemInsight = {
      item_key: key,
      item_label: label,
      category,
      requests_7d: r7,
      requests_prev_7d: prev,
      requests_30d: r30,
      urgent_lost: rows.filter((e) => e.urgent && !FULFILLED.has(e.status)).length,
      trend,
      demand_value_inr: budgets.reduce((a, b) => a + b, 0),
      budget_median_inr: med,
      peak_hour: peak,
      events: linked,
      recommendation,
      reason,
    };
    if (multi) {
      const m = new Map<string, { store_id: string; store_label: string; requests_30d: number }>();
      for (const e of rows) {
        if (!e.store_id) continue;
        const s = m.get(e.store_id) ?? { store_id: e.store_id, store_label: e.store_label ?? e.store_id, requests_30d: 0 };
        s.requests_30d++;
        m.set(e.store_id, s);
      }
      item.by_store = [...m.values()].sort((a, b) => b.requests_30d - a.requests_30d);
    }
    items.push(item);
  }

  const rank = { restock_now: 0, watch: 1, skip: 2 } as const;
  items.sort((a, b) => rank[a.recommendation] - rank[b.recommendation] || b.requests_7d - a.requests_7d || b.requests_30d - a.requests_30d);

  const daily: Insights['daily'] = [];
  for (let i = 29; i >= 0; i--) {
    const date = istDate(new Date(Date.parse(todayISO + 'T06:30:00Z') - i * DAY));
    daily.push({ date, count: 0 });
  }
  const dayIdx = new Map(daily.map((d, i) => [d.date, i]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const stores = new Map<string, { store_id: string; store_label: string; count: number }>();
  for (const e of recent) {
    const d = new Date(e.created_at);
    const i = dayIdx.get(istDate(d));
    if (i !== undefined) daily[i].count++;
    hourly[istHour(d)].count++;
    if (e.store_id) {
      const s = stores.get(e.store_id) ?? { store_id: e.store_id, store_label: e.store_label ?? e.store_id, count: 0 };
      s.count++;
      stores.set(e.store_id, s);
    }
  }

  const top = items.find((i) => i.recommendation === 'restock_now');
  const next = upcoming[0];
  const headline = top
    ? `${top.requests_7d} logon ne is hafte ${top.item_label} maanga${top.events[0] ? `, ${top.events[0].name} ${top.events[0].days_away} din mein hai` : ''}. Abhi stock karein.`
    : items.length
      ? `${recent.length} requests in 30 days. Nothing needs restocking right now${next ? `; ${next.name} is ${next.days_away} days away` : ''}.`
      : 'No requests yet in the last 30 days.';

  const out: Insights = { items, daily, hourly, upcoming, headline };
  if (multi) out.byStore = [...stores.values()].sort((a, b) => b.count - a.count);
  return out;
}
