import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInsights, seasonCalendar, tierFor, upcomingEvents, type DemandEvent, type Tier } from './index';

const today = new Date('2026-10-31T09:00:00.000Z');
const dayMs = 86_400_000;
function event(itemKey: string, daysAgo: number, overrides: Partial<DemandEvent> = {}): DemandEvent {
  return {
    item_key: itemKey,
    item_label: itemKey,
    category: 'toys',
    created_at: new Date(today.getTime() - daysAgo * dayMs).toISOString(),
    max_budget: 1000,
    urgent: false,
    status: 'open',
    ...overrides,
  };
}
function item(events: DemandEvent[], itemKey: string, tier: Tier = 'small') {
  return buildInsights(events, { today, tier }).items.find((result) => result.item_key === itemKey)!;
}

test('calendar contains six requested events with source labels', () => {
  const calendar = seasonCalendar();
  assert.equal(calendar.length, 6);
  assert.deepEqual(calendar.map(({ id, date }) => [id, date]), [
    ['dhanteras', '2026-11-06'], ['diwali', '2026-11-08'], ['bhai_dooj', '2026-11-11'],
    ['childrens_day', '2026-11-14'], ['christmas', '2026-12-25'], ['new_year', '2027-01-01'],
  ]);
  assert.ok(calendar.every((event) => event.source === 'verified 31 Oct 2026' || event.source === 'fixed date'));
});

test('upcoming events use IST day and include horizon boundary', () => {
  const result = upcomingEvents(new Date('2026-10-31T20:00:00.000Z'), 5);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'dhanteras');
  assert.equal(result[0].days_away, 5);
  assert.deepEqual(upcomingEvents(today, 0), []);
});

test('rising trend uses exact 1.5 threshold', () => {
  assert.equal(item([...Array.from({ length: 3 }, () => event('rise', 1)), event('rise', 8), event('rise', 9)], 'rise').trend, 'rising');
});

test('steady trend holds when neither threshold is met', () => {
  assert.equal(item([event('steady', 1), event('steady', 2), event('steady', 8), event('steady', 9)], 'steady').trend, 'steady');
});

test('falling trend uses half threshold', () => {
  assert.equal(item([event('fall', 1), event('fall', 8), event('fall', 9)], 'fall').trend, 'falling');
});

test('five requests in seven days recommends restock without event', () => {
  const events = Array.from({ length: 5 }, (_, index) => event('five', index, { category: 'sports' }));
  assert.equal(item(events, 'five').recommendation, 'restock_now');
});

test('three requests and linked event recommends restock', () => {
  const result = item(Array.from({ length: 3 }, (_, index) => event('diwali_toy', index)), 'diwali_toy');
  assert.equal(result.recommendation, 'restock_now');
  assert.ok(result.events.some((event) => event.id === 'diwali' && event.days_away === 8));
  assert.ok(result.events.some((event) => event.id === 'childrens_day' && event.days_away === 14));
});

test('rising trend with eight 30-day requests recommends restock', () => {
  const events = [
    ...Array.from({ length: 3 }, () => event('rising_old', 1, { category: 'sports' })),
    event('rising_old', 8, { category: 'sports' }), event('rising_old', 9, { category: 'sports' }),
    ...[15, 17, 22].map((day) => event('rising_old', day, { category: 'sports' })),
  ];
  const result = item(events, 'rising_old');
  assert.equal(result.trend, 'rising');
  assert.equal(result.requests_30d, 8);
  assert.equal(result.recommendation, 'restock_now');
});

test('two 30-day requests recommends watch when restock rules do not apply', () => {
  const result = item([event('watch', 1, { category: 'sports' }), event('watch', 8, { category: 'sports' })], 'watch');
  assert.equal(result.recommendation, 'watch');
});

test('single request recommends skip', () => {
  assert.equal(item([event('skip', 1, { category: 'sports' })], 'skip').recommendation, 'skip');
});

test('urgent closed request increments urgent_lost and leaves demand counts', () => {
  const result = buildInsights([
    event('urgent', 0, { urgent: true, status: 'closed' }),
    event('urgent', 1, { urgent: false }),
  ], { today, tier: 'small' });
  const insight = result.items[0];
  assert.equal(insight.urgent_lost, 1);
  assert.equal(insight.requests_7d, 1);
  assert.equal(insight.requests_30d, 1);
  assert.equal(result.daily.reduce((sum, day) => sum + day.count, 0), 1);
});

test('event linking follows category and its own lead window', () => {
  const toy = item([event('toy', 0)], 'toy');
  assert.ok(toy.events.some((event) => event.id === 'diwali' && event.days_away === 8));
  const electronics = item([event('electronics', 0, { category: 'electronics' })], 'electronics');
  assert.ok(electronics.events.some((event) => event.id === 'dhanteras' && event.days_away === 6));
  assert.ok(electronics.events.some((event) => event.id === 'diwali' && event.days_away === 8));
});

test('peak hour uses IST and earliest hour wins ties', () => {
  const events = [
    event('hours', 0, { created_at: '2026-10-30T20:00:00.000Z', category: 'sports' }),
    event('hours', 0, { created_at: '2026-10-30T21:00:00.000Z', category: 'sports' }),
    event('hours', 0, { created_at: '2026-10-30T21:15:00.000Z', category: 'sports' }),
  ];
  assert.equal(item(events, 'hours').peak_hour, 2);
});

test('counts, budgets and daily chart use IST calendar windows', () => {
  const events = [
    event('windows', 0, { created_at: '2026-10-30T20:00:00.000Z', max_budget: 100 }),
    event('windows', 6, { max_budget: 200 }),
    event('windows', 7, { max_budget: 300 }),
    event('windows', 13, { max_budget: 400 }),
    event('windows', 14, { max_budget: 500 }),
  ];
  const result = buildInsights(events, { today, tier: 'small' });
  const insight = result.items[0];
  assert.equal(insight.requests_7d, 2);
  assert.equal(insight.requests_prev_7d, 2);
  assert.equal(insight.requests_30d, 5);
  assert.equal(insight.demand_value_inr, 1500);
  assert.equal(insight.budget_median_inr, 300);
  assert.equal(result.daily.find((day) => day.date === '2026-10-31')?.count, 1);
  assert.equal(result.daily.length, 30);
  assert.equal(result.hourly.length, 24);
});

test('location detail appears only for store-tagged events', () => {
  const result = buildInsights([
    event('branch', 1, { store_id: 's1', store_label: 'One' }),
    event('branch', 2, { store_id: 's1', store_label: 'One' }),
    event('branch', 3, { store_id: 's2', store_label: 'Two' }),
  ], { today, tier: 'small' });
  assert.deepEqual(result.byStore, [
    { store_id: 's1', store_label: 'One', count: 2 },
    { store_id: 's2', store_label: 'Two', count: 1 },
  ]);
  assert.deepEqual(result.items[0].by_store, [
    { store_id: 's1', store_label: 'One', requests_30d: 2 },
    { store_id: 's2', store_label: 'Two', requests_30d: 1 },
  ]);
  assert.equal(buildInsights([event('local', 1)], { today, tier: 'large' }).byStore, undefined);
  assert.equal(buildInsights([event('local', 1)], { today, tier: 'large' }).items[0].by_store, undefined);
});

test('items rank by recommendation then weekly demand', () => {
  const result = buildInsights([
    ...Array.from({ length: 5 }, () => event('now', 1, { category: 'sports' })),
    event('watch_a', 1, { category: 'sports' }), event('watch_a', 8, { category: 'sports' }),
    event('skip', 1, { category: 'sports' }),
  ], { today, tier: 'small' });
  assert.deepEqual(result.items.map((entry) => entry.item_key), ['now', 'watch_a', 'skip']);
});

test('empty input returns zero-filled charts and neutral headline', () => {
  const result = buildInsights([], { today, tier: 'small' });
  assert.deepEqual(result.items, []);
  assert.equal(result.daily.length, 30);
  assert.ok(result.daily.every((day) => day.count === 0));
  assert.equal(result.hourly.length, 24);
  assert.ok(result.hourly.every((hour) => hour.count === 0));
  assert.equal(result.byStore, undefined);
  assert.match(result.headline, /restock/i);
});

test('turnover boundaries map to stated MSME tiers', () => {
  assert.equal(tierFor(10_00_00_000, 1), 'small');
  assert.equal(tierFor(10_00_00_001, 1), 'medium');
  assert.equal(tierFor(100_00_00_000, 1), 'medium');
  assert.equal(tierFor(100_00_00_001, 1), 'large');
  assert.equal(tierFor(500_00_00_000, 1), 'large');
  assert.equal(tierFor(500_00_00_001, 1), 'very_large');
});

test('location rules raise floor to medium or very_large', () => {
  assert.equal(tierFor(0, 1), 'small');
  assert.equal(tierFor(0, 2), 'medium');
  assert.equal(tierFor(0, 9), 'medium');
  assert.equal(tierFor(0, 10), 'very_large');
  assert.equal(tierFor(150_00_00_000, 2), 'large');
});
