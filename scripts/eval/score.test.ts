import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExtractedRequest } from '../../lib/contracts';
import { scoreCase, casePassRate, THRESHOLDS } from './score';

const TODAY = '2026-10-31';
function result(over: Partial<ExtractedRequest> = {}): ExtractedRequest {
  return {
    item: null, item_key: null, hard_constraints: [], soft_preferences: [], max_budget: null, quantity: null,
    needed_by: null, needed_by_label: null, urgent: false, language: 'en-IN', missing: [], clarifying_question: null,
    source_text: '', mode: 'ai', ...over,
  };
}
const passes = (r: ExtractedRequest, expected: Record<string, unknown>) => scoreCase(r, expected, TODAY).every(c => c.pass);

test('hard_constraints is an exact set: an extra constraint fails', () => {
  assert.equal(passes(result({ hard_constraints: ['rechargeable', 'eggless'] }), { hard_constraints: ['rechargeable'] }), false);
});
test('hard_constraints is an exact set: a missing constraint fails', () => {
  assert.equal(passes(result({ hard_constraints: ['rechargeable'] }), { hard_constraints: ['rechargeable', 'size:5'] }), false);
});
test('hard_constraints ignores order', () => {
  assert.equal(passes(result({ hard_constraints: ['size:xl', 'color:maroon'] }), { hard_constraints: ['color:maroon', 'size:xl'] }), true);
});
test('hard_constraints_subset allows extras', () => {
  assert.equal(passes(result({ hard_constraints: ['rechargeable', 'eggless'] }), { hard_constraints_subset: ['rechargeable'] }), true);
});
test('hard_constraints_subset fails when an expected value is missing', () => {
  assert.equal(passes(result({ hard_constraints: ['eggless'] }), { hard_constraints_subset: ['rechargeable'] }), false);
});
test('expected empty hard_constraints needs empty result', () => {
  assert.equal(passes(result(), { hard_constraints: [] }), true);
  assert.equal(passes(result({ hard_constraints: ['eggless'] }), { hard_constraints: [] }), false);
});
test('soft_preferences_contains is a case-insensitive substring of the joined list', () => {
  assert.equal(passes(result({ soft_preferences: ['Female stylist'] }), { soft_preferences_contains: 'female' }), true);
  assert.equal(passes(result({ soft_preferences: ['male stylist'] }), { soft_preferences_contains: 'female' }), false);
});
test('item_key array is any-of', () => {
  assert.equal(passes(result({ item_key: 'toy_car' }), { item_key: ['rc_car', 'toy_car'] }), true);
  assert.equal(passes(result({ item_key: 'bike' }), { item_key: ['rc_car', 'toy_car'] }), false);
});
test('scalars are exact', () => {
  assert.equal(passes(result({ max_budget: 1000, urgent: true }), { max_budget: 1000, urgent: true }), true);
  assert.equal(passes(result({ max_budget: 1001 }), { max_budget: 1000 }), false);
  assert.equal(passes(result({ max_budget: null }), { max_budget: null }), true);
});
test('missing array is an exact set', () => {
  assert.equal(passes(result({ missing: ['max_budget'] }), { missing: ['max_budget', 'needed_by'] }), false);
  assert.equal(passes(result({ missing: ['needed_by', 'max_budget'] }), { missing: ['max_budget', 'needed_by'] }), true);
});
test('forbidden_hard_prefix rejects a matching constraint', () => {
  assert.equal(passes(result({ hard_constraints: ['color:red'] }), { forbidden_hard_prefix: 'color:' }), false);
  assert.equal(passes(result({ hard_constraints: ['size:5'] }), { forbidden_hard_prefix: 'color:' }), true);
});
test('deadline_token compares needed_by with the resolved date', () => {
  assert.equal(passes(result({ needed_by: '2026-11-01' }), { deadline_token: 'tomorrow' }), true);
  assert.equal(passes(result({ needed_by: '2026-10-31' }), { deadline_token: 'tomorrow' }), false);
});
test('casePassRate: 7 of 10 all-pass rows is 0.7', () => {
  const ok = { checks: [{ field: 'a', expected: 1, got: 1, pass: true }] };
  const bad = { checks: [{ field: 'a', expected: 1, got: 1, pass: true }, { field: 'b', expected: 1, got: 2, pass: false }] };
  assert.equal(casePassRate([...Array(7).fill(ok), ...Array(3).fill(bad)]), 0.7);
});
test('casePassRate: no rows is 0 and a row with zero checks does not pass', () => {
  assert.equal(casePassRate([]), 0);
  assert.equal(casePassRate([{ checks: [] }]), 0);
});
test('thresholds', () => {
  assert.deepEqual(THRESHOLDS, { ai: 0.7, rules: 0.6 });
});
