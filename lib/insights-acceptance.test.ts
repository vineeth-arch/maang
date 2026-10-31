// Acceptance tests for the LIVE insights path: lib/insights-entry.ts -> lib/insights-local.ts.
// They pin current behaviour. lib/insights/index.ts is a different, unused policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInsights, tierFor, type DemandEvent, type Insights, type Tier } from './insights-entry';

const NOW = new Date('2026-10-31T09:00:00Z'); // 14:30 IST, same calendar date
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();

type Opts = { category?: string | null; store?: [string, string] };
function row(key: string, daysAgo: number, o: Opts = {}): DemandEvent {
  return {
    item_key: key,
    item_label: key,
    category: o.category === undefined ? 'sports' : o.category,
    created_at: at(daysAgo),
    max_budget: 1000,
    urgent: false,
    status: 'closed',
    store_id: o.store?.[0] ?? null,
    store_label: o.store?.[1] ?? null,
  };
}
// n events inside the last 7 days (0.5 .. <7), safely clear of the boundary.
const last7 = (key: string, n: number, o?: Opts) => Array.from({ length: n }, (_, i) => row(key, 0.5 + i * 0.5, o));
// n events in the 7-14 day window (7.5 .. <14).
const prev7 = (key: string, n: number, o?: Opts) => Array.from({ length: n }, (_, i) => row(key, 7.5 + i * 0.5, o));
// n events at a given age.
const atAge = (key: string, n: number, daysAgo: number, o?: Opts) => Array.from({ length: n }, (_, i) => row(key, daysAgo + i * 0.1, o));

function itemOf(events: DemandEvent[], key: string, tier: Tier = 'small') {
  const it = buildInsights(events, { today: NOW, tier }).items.find((i) => i.item_key === key);
  assert.ok(it, `item ${key} should exist`);
  return it;
}

// Sanity on the fixture helpers, so a wrong helper cannot make the tables pass by accident.
test('fixture helpers place events in the intended windows', () => {
  const it = itemOf([...last7('x', 10), ...prev7('x', 10)], 'x');
  assert.equal(it.requests_7d, 10);
  assert.equal(it.requests_prev_7d, 10);
  assert.equal(it.requests_30d, 20);
});

const trendCases: { r7: number; prev: number; want: 'rising' | 'steady' | 'falling'; why: string }[] = [
  { r7: 6, prev: 3, want: 'rising', why: '2x and +3' },
  { r7: 4, prev: 1, want: 'rising', why: '4x and +3' },
  { r7: 6, prev: 4, want: 'steady', why: 'only +2' },
  { r7: 10, prev: 7, want: 'steady', why: '10 < 1.5 x 7' },
  { r7: 3, prev: 1, want: 'steady', why: 'only +2' },
  { r7: 1, prev: 4, want: 'falling', why: '4 >= 1.5 x 1 and -3' },
];
for (const c of trendCases) {
  test(`trend: ${c.r7} this week / ${c.prev} last week is ${c.want} (${c.why})`, () => {
    const events = [...last7('t', c.r7), ...prev7('t', c.prev)];
    assert.equal(itemOf(events, 't').trend, c.want);
  });
}

const recoCases: { name: string; category: string; r7: number; prev: number; old?: number; want: 'restock_now' | 'watch' | 'skip' }[] = [
  { name: 'rising with 5 this week, no festival category', category: 'sports', r7: 5, prev: 1, want: 'restock_now' },
  { name: 'rising with only 4 this week, no festival category', category: 'sports', r7: 4, prev: 1, want: 'watch' },
  { name: '3 this week, toys, Diwali in window', category: 'toys', r7: 3, prev: 2, want: 'restock_now' },
  { name: '3 this week, electronics, Dhanteras in window', category: 'electronics', r7: 3, prev: 2, want: 'restock_now' },
  { name: '3 this week, books, Childrens Day outside its window', category: 'books', r7: 3, prev: 2, want: 'watch' },
  { name: 'exactly one request in 30 days, toys', category: 'toys', r7: 1, prev: 0, want: 'skip' },
  { name: 'no requests this week, 2 at day 20', category: 'sports', r7: 0, prev: 0, old: 2, want: 'watch' },
];
for (const c of recoCases) {
  test(`recommendation: ${c.name} -> ${c.want}`, () => {
    const o = { category: c.category };
    const events = [...last7('r', c.r7, o), ...prev7('r', c.prev, o), ...(c.old ? atAge('r', c.old, 20, o) : [])];
    assert.equal(itemOf(events, 'r').recommendation, c.want);
  });
}

test('event linking at the pinned date: Diwali and Dhanteras link, Childrens Day does not', () => {
  const toys = itemOf(last7('a', 3, { category: 'toys' }), 'a');
  assert.deepEqual(toys.events.map((e) => [e.name, e.days_away]), [['Diwali', 8]]);
  const elec = itemOf(last7('b', 3, { category: 'electronics' }), 'b');
  assert.deepEqual(elec.events.map((e) => [e.name, e.days_away]), [['Dhanteras', 6], ['Diwali', 8]]);
  const books = itemOf(last7('c', 3, { category: 'books' }), 'c');
  assert.deepEqual(books.events, []);
});

const tierCases: { rev: number; loc: number; want: Tier }[] = [
  { rev: 39_99_999, loc: 1, want: 'small' },
  { rev: 40_00_000, loc: 1, want: 'medium' },
  { rev: 4_99_99_999, loc: 2, want: 'medium' },
  { rev: 5_00_00_000, loc: 1, want: 'large' },
  { rev: 0, loc: 3, want: 'large' },
  { rev: 49_99_99_999, loc: 9, want: 'large' },
  { rev: 50_00_00_000, loc: 1, want: 'very_large' },
  { rev: 0, loc: 10, want: 'very_large' },
];
for (const c of tierCases) {
  test(`tierFor(${c.rev}, ${c.loc}) is ${c.want}`, () => {
    assert.equal(tierFor(c.rev, c.loc), c.want);
  });
}

const S1: [string, string] = ['s1', 'A'];
const S2: [string, string] = ['s2', 'B'];
function storeEvents(): { all: DemandEvent[]; inWindow: number } {
  const in30 = [
    ...last7('p', 4, { store: S1 }),
    ...last7('p', 2, { store: S2 }),
    ...prev7('p', 3, { store: S2 }),
    ...atAge('q', 3, 20, { store: S1 }),
    ...last7('q', 2, { store: S2 }),
  ];
  const outside = [row('p', 35, { store: S1 }), row('q', 40, { store: S2 })];
  return { all: [...in30, ...outside], inWindow: in30.length };
}

test('totals: large tier byStore counts sum to in-window events and match per-item by_store', () => {
  const { all, inWindow } = storeEvents();
  const ins = buildInsights(all, { today: NOW, tier: 'large' });
  assert.ok(ins.byStore);
  assert.equal(ins.byStore.reduce((a, s) => a + s.count, 0), inWindow);
  assert.deepEqual(Object.fromEntries(ins.byStore.map((s) => [s.store_id, s.store_label])), { s1: 'A', s2: 'B' });
  for (const it of ins.items) {
    assert.ok(it.by_store, `${it.item_key} has by_store`);
    assert.equal(it.by_store.reduce((a, s) => a + s.requests_30d, 0), it.requests_30d);
  }
  assert.equal(ins.items.reduce((a, i) => a + i.requests_30d, 0), inWindow);
});

test('totals: small tier has no byStore and no per-item by_store', () => {
  const ins = buildInsights(storeEvents().all, { today: NOW, tier: 'small' });
  assert.equal(ins.byStore, undefined);
  for (const it of ins.items) assert.equal(it.by_store, undefined);
});

const sum = (ins: Insights) => ins.daily.reduce((a, d) => a + d.count, 0);

test('daily: 30 consecutive IST dates ending today, sums to in-window events', () => {
  const { all, inWindow } = storeEvents();
  const ins = buildInsights(all, { today: NOW, tier: 'small' });
  assert.equal(ins.daily.length, 30);
  assert.equal(ins.daily[29].date, '2026-10-31');
  assert.equal(ins.daily[0].date, '2026-10-02');
  assert.equal(sum(ins), inWindow);
});

// The 30-day window is the 30 IST calendar dates shown by daily (2 Oct to 31 Oct here).
test('daily and 30-day totals agree at the window edge (1 Oct out, 2 Oct in)', () => {
  const out = buildInsights([row('e', 29.8)], { today: NOW, tier: 'small' });
  assert.equal(out.items.length, 0);
  assert.equal(sum(out), 0);
  const inn = buildInsights([row('e', 29.2)], { today: NOW, tier: 'small' });
  assert.equal(inn.items[0].requests_30d, 1);
  assert.equal(sum(inn), 1);
});
