import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInsights, tierFor, upcomingEvents, type DemandEvent } from './insights-entry';

const today = new Date('2026-10-31T09:00:00Z');
const ago = (d: number) => new Date(today.getTime() - d * 86_400_000).toISOString();
const ev = (key: string, d: number, category = 'toys'): DemandEvent => ({ item_key: key, item_label: key, category, created_at: ago(d), max_budget: 1000, urgent: false, status: 'closed' });

test('rising item before Diwali is restock_now, single ask is skip, steady is watch', () => {
  const events = [
    ...[1, 1, 2, 2, 3, 3, 4, 5, 6].map((d) => ev('rc_car', d)),
    ev('rc_car', 9),
    ev('drone', 18),
    ...[2, 4, 6, 8, 10, 12].map((d) => ev('bat', d, 'sports')),
  ];
  const ins = buildInsights(events, { today, tier: 'small' });
  const by = Object.fromEntries(ins.items.map((i) => [i.item_key, i]));
  assert.equal(by.rc_car.recommendation, 'restock_now');
  assert.equal(by.rc_car.trend, 'rising');
  assert.equal(by.drone.recommendation, 'skip');
  assert.equal(by.bat.recommendation, 'watch');
  assert.equal(ins.daily.length, 30);
  assert.equal(ins.byStore, undefined);
});

test('tiers and calendar', () => {
  assert.equal(tierFor(20_00_000, 1), 'small');
  assert.equal(tierFor(1_00_00_000, 1), 'medium');
  assert.equal(tierFor(1_00_00_000, 3), 'large');
  assert.equal(tierFor(100_00_00_000, 3), 'very_large');
  assert.equal(upcomingEvents(today)[0].name, 'Dhanteras');
});
