export type Tier = 'small' | 'medium' | 'large' | 'very_large';
export type DemandEvent = { item_key: string; item_label: string; category: string | null; created_at: string; max_budget: number | null; urgent: boolean; status: string; store_id?: string | null; store_label?: string | null };
export type SeasonEvent = { id: string; name: string; date: string; window_days_before: number; categories: string[]; source: string };
export type UpcomingEvent = SeasonEvent & { days_away: number };
export type ItemInsight = { item_key: string; item_label: string; category: string | null; requests_7d: number; requests_prev_7d: number; requests_30d: number; urgent_lost: number; trend: 'rising' | 'steady' | 'falling'; demand_value_inr: number; budget_median_inr: number | null; peak_hour: number | null; events: { id: string; name: string; days_away: number }[]; recommendation: 'restock_now' | 'watch' | 'skip'; reason: string; by_store?: { store_id: string; store_label: string; requests_30d: number }[] };
export type Insights = { items: ItemInsight[]; daily: { date: string; count: number }[]; hourly: { hour: number; count: number }[]; byStore?: { store_id: string; store_label: string; count: number }[]; upcoming: UpcomingEvent[]; headline: string };

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Regional festivals (for example Teej, when ghevar sells) and sale events (for example a Flipkart sale) are added by the merchant in the pilot, not hardcoded.
export function seasonCalendar(): SeasonEvent[] {
  return [
    { id: 'dhanteras', name: 'Dhanteras', date: '2026-11-06', window_days_before: 14, categories: ['electronics', 'appliances', 'utensils', 'jewellery'], source: 'verified 31 Oct 2026' },
    { id: 'diwali', name: 'Diwali', date: '2026-11-08', window_days_before: 21, categories: ['gifts', 'toys', 'sweets', 'electronics', 'decor', 'apparel'], source: 'verified 31 Oct 2026' },
    { id: 'bhai_dooj', name: 'Bhai Dooj', date: '2026-11-11', window_days_before: 10, categories: ['gifts', 'sweets'], source: 'verified 31 Oct 2026' },
    { id: 'childrens_day', name: "Children's Day", date: '2026-11-14', window_days_before: 14, categories: ['toys', 'books', 'stationery'], source: 'fixed date' },
    { id: 'christmas', name: 'Christmas', date: '2026-12-25', window_days_before: 21, categories: ['toys', 'gifts', 'cakes', 'decor', 'electronics'], source: 'fixed date' },
    { id: 'new_year', name: 'New Year', date: '2027-01-01', window_days_before: 10, categories: ['gifts', 'electronics', 'party'], source: 'fixed date' },
  ];
}

function istDate(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function istHour(date: Date): number {
  return new Date(date.getTime() + IST_OFFSET_MS).getUTCHours();
}

function dayNumber(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00.000Z`) / DAY_MS;
}

export function upcomingEvents(today: Date, horizonDays = 45): UpcomingEvent[] {
  const todayDay = dayNumber(istDate(today));
  return seasonCalendar()
    .map((event) => ({ ...event, days_away: dayNumber(event.date) - todayDay }))
    .filter((event) => event.days_away >= 0 && event.days_away <= horizonDays)
    .sort((a, b) => a.days_away - b.days_away);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isCannotWaitLoss(event: DemandEvent): boolean {
  // Current API only provides status; closed urgent requests are the cannot-wait loss signal.
  return event.urgent && event.status === 'closed';
}

function storeLabel(event: DemandEvent): string {
  return event.store_label?.trim() || event.store_id || '';
}

export function buildInsights(events: DemandEvent[], opts: { today: Date; tier: Tier }): Insights {
  const today = istDate(opts.today);
  const todayDay = dayNumber(today);
  const start30 = todayDay - 29;
  const start7 = todayDay - 6;
  const startPrevious7 = todayDay - 13;
  const upcoming = upcomingEvents(opts.today);
  const recent = events.filter((event) => {
    const timestamp = Date.parse(event.created_at);
    if (!Number.isFinite(timestamp)) return false;
    const day = dayNumber(istDate(new Date(timestamp)));
    return day >= start30 && day <= todayDay;
  });
  const counted = recent.filter((event) => !isCannotWaitLoss(event));

  const groups = new Map<string, DemandEvent[]>();
  for (const event of recent) {
    const group = groups.get(event.item_key);
    if (group) group.push(event);
    else groups.set(event.item_key, [event]);
  }

  const items: ItemInsight[] = [];
  for (const [itemKey, rows] of groups) {
    const itemRows = rows.filter((event) => !isCannotWaitLoss(event));
    const dayOf = (event: DemandEvent) => dayNumber(istDate(new Date(event.created_at)));
    const requests7 = itemRows.filter((event) => dayOf(event) >= start7).length;
    const previous7 = itemRows.filter((event) => dayOf(event) >= startPrevious7 && dayOf(event) < start7).length;
    const requests30 = itemRows.length;
    const trend: ItemInsight['trend'] = requests7 >= 1.5 * previous7 && requests7 >= 3
      ? 'rising'
      : requests7 <= 0.5 * previous7 && previous7 >= 2
        ? 'falling'
        : 'steady';
    const budgets = itemRows
      .map((event) => event.max_budget)
      .filter((budget): budget is number => typeof budget === 'number' && Number.isFinite(budget) && budget >= 0);
    const hourlyCounts = Array.from({ length: 24 }, () => 0);
    for (const event of itemRows) hourlyCounts[istHour(new Date(event.created_at))]++;
    const peakHour = itemRows.length > 0 ? hourlyCounts.indexOf(Math.max(...hourlyCounts)) : null;
    const category = rows.find((event) => event.category)?.category ?? null;
    const linkedEvents = upcoming
      .filter((event) => category !== null && event.categories.includes(category) && event.days_away <= event.window_days_before)
      .map(({ id, name, days_away }) => ({ id, name, days_away }));
    const label = [...rows].reverse().find((event) => event.item_label.trim())?.item_label.trim() || itemKey;
    const urgentLost = rows.filter(isCannotWaitLoss).length;

    let recommendation: ItemInsight['recommendation'];
    if (requests7 >= 5 || (requests7 >= 3 && linkedEvents.length > 0) || (trend === 'rising' && requests30 >= 8)) {
      recommendation = 'restock_now';
    } else if (requests30 >= 2) {
      recommendation = 'watch';
    } else {
      recommendation = 'skip';
    }

    const eventName = linkedEvents[0];
    const comparison = trend === 'rising'
      ? `up from ${previous7}`
      : trend === 'falling'
        ? `down from ${previous7}`
        : `versus ${previous7} the week before`;
    const eventSentence = eventName ? ` ${eventName.name} is in ${eventName.days_away} days.` : '';
    const reason = `${requests7} asked in 7 days, ${comparison}; ${requests30} in 30 days.${eventSentence}`;

    const item: ItemInsight = {
      item_key: itemKey,
      item_label: label,
      category,
      requests_7d: requests7,
      requests_prev_7d: previous7,
      requests_30d: requests30,
      urgent_lost: urgentLost,
      trend,
      demand_value_inr: budgets.reduce((sum, budget) => sum + budget, 0),
      budget_median_inr: median(budgets),
      peak_hour: peakHour,
      events: linkedEvents,
      recommendation,
      reason,
    };

    const stores = new Map<string, { store_id: string; store_label: string; requests_30d: number }>();
    for (const event of itemRows) {
      if (!event.store_id) continue;
      const existing = stores.get(event.store_id) ?? {
        store_id: event.store_id,
        store_label: storeLabel(event),
        requests_30d: 0,
      };
      existing.requests_30d++;
      stores.set(event.store_id, existing);
    }
    if (stores.size > 0) {
      item.by_store = [...stores.values()].sort((a, b) => b.requests_30d - a.requests_30d || a.store_id.localeCompare(b.store_id));
    }
    items.push(item);
  }

  const recommendationRank = { restock_now: 0, watch: 1, skip: 2 } as const;
  items.sort((a, b) => recommendationRank[a.recommendation] - recommendationRank[b.recommendation] || b.requests_7d - a.requests_7d || a.item_key.localeCompare(b.item_key));

  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = new Date((start30 + index) * DAY_MS).toISOString().slice(0, 10);
    return { date, count: 0 };
  });
  const dailyIndex = new Map(daily.map((entry, index) => [entry.date, index]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const storeTotals = new Map<string, { store_id: string; store_label: string; count: number }>();
  for (const event of counted) {
    const date = istDate(new Date(event.created_at));
    const index = dailyIndex.get(date);
    if (index !== undefined) daily[index].count++;
    hourly[istHour(new Date(event.created_at))].count++;
    if (event.store_id) {
      const existing = storeTotals.get(event.store_id) ?? {
        store_id: event.store_id,
        store_label: storeLabel(event),
        count: 0,
      };
      existing.count++;
      storeTotals.set(event.store_id, existing);
    }
  }

  const byStore = [...storeTotals.values()].sort((a, b) => b.count - a.count || a.store_id.localeCompare(b.store_id));
  const top = items.find((item) => item.recommendation === 'restock_now');
  const headline = top
    ? `${top.requests_7d} log ${top.item_label} is hafte maang rahe hain.${top.events[0] ? ` ${top.events[0].name} ${top.events[0].days_away} din mein hai.` : ''} Stock kar lo.`
    : 'Abhi turant restock ki zaroorat nahi. Maang par nazar rakho.';

  const result: Insights = { items, daily, hourly, upcoming, headline };
  if (recent.some((event) => Boolean(event.store_id))) result.byStore = byStore;
  return result;
}

export const TIER_INFO: Record<Tier, { label: string; band: string; modules: string[] }> = {
  small: {
    label: 'Small',
    band: 'Turnover up to ₹10 crore',
    modules: ['headline', 'events', 'top5'],
  },
  medium: {
    label: 'Medium',
    band: 'Turnover above ₹10 crore up to ₹100 crore',
    modules: ['headline', 'events', 'top5', 'full_table', 'daily_chart', 'hourly_chart', 'csv'],
  },
  large: {
    label: 'Large',
    band: 'Turnover above ₹100 crore up to ₹500 crore',
    modules: ['headline', 'events', 'top5', 'full_table', 'daily_chart', 'hourly_chart', 'csv', 'by_location'],
  },
  very_large: {
    label: 'Very large',
    band: 'Turnover above ₹500 crore',
    modules: ['headline', 'events', 'top5', 'full_table', 'daily_chart', 'hourly_chart', 'csv', 'by_location', 'location_matrix'],
  },
};

export function tierFor(annualRevenueInr: number, locations: number): Tier {
  if (locations >= 10 || annualRevenueInr > 500_00_00_000) return 'very_large';
  if (annualRevenueInr > 100_00_00_000) return 'large';
  if (locations >= 2 || annualRevenueInr > 10_00_00_000) return 'medium';
  return 'small';
}
