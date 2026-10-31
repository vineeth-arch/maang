import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExtractedRequest } from '../contracts';
import { keepRulesFindings } from './extract';

const base: ExtractedRequest = {
  item: null, item_key: null, hard_constraints: [], soft_preferences: [], max_budget: 500, quantity: null,
  needed_by: '2026-11-01', needed_by_label: 'kal', urgent: false, language: 'hi-IN', missing: [],
  clarifying_question: null, source_text: 'eggless cake chahiye 500 tak kal', mode: 'ai',
};
const rules: ExtractedRequest = { ...base, item: 'eggless cake', item_key: 'cake', hard_constraints: ['eggless'], mode: 'rules_fallback' };

test('AI null item_key keeps the rules item and constraints (case 11)', () => {
  const out = keepRulesFindings({ ...base, missing: ['item'], clarifying_question: 'Kya chahiye?' }, rules);
  assert.equal(out.item_key, 'cake');
  assert.equal(out.item, 'eggless cake');
  assert.deepEqual(out.hard_constraints, ['eggless']);
  assert.deepEqual(out.missing, []);
  assert.equal(out.mode, 'ai');
});

test('AI with fewer constraints gets the union', () => {
  const out = keepRulesFindings({ ...base, item: 'cake', item_key: 'cake', soft_preferences: ['eggless'] }, { ...rules, hard_constraints: ['eggless', 'size:1kg'] });
  assert.deepEqual(out.hard_constraints.sort(), ['eggless', 'size:1kg']);
  assert.deepEqual(out.soft_preferences, []);
});

test('AI that found at least as much is returned unchanged', () => {
  const ai = { ...base, item: 'rc car', item_key: 'rc_car', hard_constraints: ['rechargeable'] };
  assert.equal(keepRulesFindings(ai, { ...rules, item_key: 'rc_car', hard_constraints: ['rechargeable'] }), ai);
});
