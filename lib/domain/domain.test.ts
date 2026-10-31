import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todayIST, addDaysISO, resolveRelative, isValidFutureISO, formatDeadline,
  budgetBucket, clusterKey, clusterLabel, isExpired, matchProducts, canTransition,
  maskPhone, formatINR, formatRs,
} from './index';
import type { Product, RequestStatus } from '../api-types';

const mk = (id: string, item_key: string, tags: string[], price: number, stock: number): Product => ({
  id, shop_id: 's1', item_key, name: id, tags, price, stock_available: stock, synthetic: true,
});
const products: Product[] = [
  mk('RC-01', 'rc_car', ['rechargeable'], 899, 0),
  mk('RC-02', 'rc_car', ['disposable_batteries'], 799, 3),
  mk('GH-01', 'gift_hamper', [], 449, 0),
  mk('PZ-01', 'jigsaw_puzzle', ['pieces:500'], 599, 2),
];

test('budgetBucket edges', () => {
  assert.equal(budgetBucket(null), 'any');
  assert.equal(budgetBucket(250), '250');
  assert.equal(budgetBucket(251), '500');
  assert.equal(budgetBucket(500), '500');
  assert.equal(budgetBucket(1000), '1000');
  assert.equal(budgetBucket(1001), '2000');
  assert.equal(budgetBucket(5000), '5000');
  assert.equal(budgetBucket(5001), '5000+');
});

test('clusterKey sorts, nulls', () => {
  assert.equal(clusterKey({ urgent: false, item_key: 'x', hard_constraints: ['b', 'a'], max_budget: null }), 'x|a,b|any');
  assert.equal(clusterKey({ urgent: true, item_key: 'x', hard_constraints: [], max_budget: 100 }), null);
  assert.equal(clusterKey({ urgent: false, item_key: null, hard_constraints: [], max_budget: 100 }), null);
});

test('seed parity', () => {
  assert.equal(clusterKey({ urgent: false, item_key: 'rc_car', hard_constraints: ['rechargeable'], max_budget: 1000 }), 'rc_car|rechargeable|1000');
  assert.equal(clusterKey({ urgent: false, item_key: 'gift_hamper', hard_constraints: [], max_budget: 500 }), 'gift_hamper||500');
  assert.equal(clusterKey({ urgent: false, item_key: 'jigsaw_puzzle', hard_constraints: ['pieces:1000'], max_budget: 800 }), 'jigsaw_puzzle|pieces:1000|1000');
});

test('clusterLabel', () => {
  assert.equal(clusterLabel('rc_car', ['rechargeable'], '1000'), 'Rechargeable RC car · under ₹1,000');
  assert.equal(clusterLabel('gift_hamper', [], '500'), 'Gift hamper · under ₹500');
  assert.equal(clusterLabel('jigsaw_puzzle', ['pieces:1000'], '1000'), 'Jigsaw puzzle, 1000 pieces · under ₹1,000');
  assert.equal(clusterLabel('cricket_bat', [], 'any'), 'Cricket bat');
  assert.equal(clusterLabel('cricket_bat', [], '5000+'), 'Cricket bat · over ₹5,000');
  assert.equal(clusterLabel('rc_car', ['disposable_batteries'], '500'), 'AA-battery RC car · under ₹500');
  assert.equal(clusterLabel('water_bottle', [], 'any'), 'Water bottle');
});

test('matchProducts rechargeable under budget', () => {
  const r = { item_key: 'rc_car', hard_constraints: ['rechargeable'], max_budget: 1000 };
  const m = matchProducts(r, products);
  assert.deepEqual(m.eligible.map((p) => p.id), ['RC-01']);
  assert.equal(m.rejected.length, 1);
  assert.equal(m.rejected[0].product.id, 'RC-02');
  assert.equal(m.rejected[0].reasons[0].code, 'missing_constraint:rechargeable');
  assert.equal(m.rejected[0].reasons[0].text, 'uses AA batteries, customer needs rechargeable');
});

test('matchProducts over budget', () => {
  const m = matchProducts({ item_key: 'rc_car', hard_constraints: ['rechargeable'], max_budget: 800 }, products);
  assert.deepEqual(m.eligible, []);
  const rc1 = m.rejected.find((x) => x.product.id === 'RC-01');
  assert.ok(rc1);
  assert.deepEqual(rc1.reasons, [{ code: 'over_budget', text: 'Rs 899 is over budget Rs 800' }]);
});

test('matchProducts puzzle pieces mismatch', () => {
  const m = matchProducts({ item_key: 'jigsaw_puzzle', hard_constraints: ['pieces:1000'], max_budget: 800 }, products);
  assert.deepEqual(m.eligible, []);
  assert.equal(m.rejected.length, 1);
  assert.equal(m.rejected[0].product.id, 'PZ-01');
  assert.equal(m.rejected[0].reasons[0].text, 'has 500 pieces, customer needs 1000');
});

test('matchProducts collects all reasons and generic text', () => {
  const m = matchProducts({ item_key: 'rc_car', hard_constraints: ['rechargeable', 'color:red'], max_budget: 100 }, products);
  const rc2 = m.rejected.find((x) => x.product.id === 'RC-02');
  assert.ok(rc2);
  assert.deepEqual(rc2.reasons.map((x) => x.code), ['missing_constraint:rechargeable', 'missing_constraint:color:red', 'over_budget']);
  assert.equal(rc2.reasons[1].text, 'does not meet: color:red');
  const rc1 = m.rejected.find((x) => x.product.id === 'RC-01');
  assert.ok(rc1);
  const bat = matchProducts({ item_key: 'rc_car', hard_constraints: ['disposable_batteries'], max_budget: null }, products);
  assert.equal(bat.rejected[0].reasons[0].text, 'is rechargeable, customer asked for battery-cell type');
});

test('isExpired', () => {
  assert.equal(isExpired({ needed_by: '2026-10-30', status: 'open' }, '2026-10-31'), true);
  assert.equal(isExpired({ needed_by: '2026-10-30', status: 'notified' }, '2026-10-31'), true);
  assert.equal(isExpired({ needed_by: '2026-10-30', status: 'picked_up' }, '2026-10-31'), false);
  assert.equal(isExpired({ needed_by: '2026-10-31', status: 'open' }, '2026-10-31'), false);
  assert.equal(isExpired({ needed_by: null, status: 'open' }, '2026-10-31'), false);
});

test('canTransition all 25 pairs', () => {
  const all: RequestStatus[] = ['open', 'notified', 'reserved', 'picked_up', 'closed'];
  const allowed = new Set(['open>notified', 'open>closed', 'notified>reserved', 'notified>closed', 'reserved>picked_up', 'reserved>closed']);
  let trues = 0;
  for (const a of all) for (const b of all) {
    const expected = allowed.has(`${a}>${b}`);
    assert.equal(canTransition(a, b), expected, `${a}>${b}`);
    if (canTransition(a, b)) trues++;
  }
  assert.equal(trues, 6);
});

test('time helpers', () => {
  assert.equal(todayIST(new Date('2026-10-31T20:00:00Z')), '2026-11-01');
  assert.equal(todayIST(new Date('2026-10-31T10:00:00Z')), '2026-10-31');
  assert.equal(addDaysISO('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01');
  assert.equal(resolveRelative('tomorrow', '2026-10-31'), '2026-11-01');
  assert.equal(resolveRelative('none', '2026-10-31'), null);
  assert.equal(isValidFutureISO('2026-10-31', '2026-10-31'), true);
  assert.equal(isValidFutureISO('2026-10-30', '2026-10-31'), false);
  assert.equal(isValidFutureISO('2027-10-31', '2026-10-31'), true);
  assert.equal(isValidFutureISO('2027-11-01', '2026-10-31'), false);
  assert.equal(isValidFutureISO('2026-02-30', '2026-01-01'), false);
  assert.equal(isValidFutureISO('2026-1-5', '2026-01-01'), false);
  assert.equal(isValidFutureISO('2026-11-01T00:00', '2026-10-31'), false);
});

test('formatDeadline', () => {
  assert.equal(formatDeadline(null, '2026-10-31'), '—');
  assert.equal(formatDeadline('2026-10-31', '2026-10-31'), 'Aaj, 31 Oct');
  assert.equal(formatDeadline('2026-11-01', '2026-10-31'), 'Kal, 1 Nov');
  assert.equal(formatDeadline('2026-11-02', '2026-10-31'), 'Mon, 2 Nov');
  assert.equal(formatDeadline('2026-10-28', '2026-10-31'), 'Wed, 28 Oct');
});

test('format helpers', () => {
  assert.equal(maskPhone(null), null);
  assert.equal(maskPhone(''), null);
  assert.equal(maskPhone('9876540101'), '******0101');
  assert.equal(formatINR(1000), '₹1,000');
  assert.equal(formatINR(100000), '₹1,00,000');
  assert.equal(formatRs(1299), 'Rs 1,299');
});
