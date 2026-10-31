import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExtractedRequest } from '../contracts';
import { keepRulesFindings } from './extract';
import { extractRules } from './rules';

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

const sorted = (xs: string[]) => [...xs].sort();

test('CX-01: rules eggless + AI sugar_free gives both (membership, not length)', () => {
  const out = keepRulesFindings({ ...base, item: 'cake', item_key: 'cake', hard_constraints: ['sugar_free'] }, rules);
  assert.deepEqual(sorted(out.hard_constraints), ['eggless', 'sugar_free']);
});

test('CX-01: AI rechargeable + size:m with rules pieces:100 keeps all three', () => {
  const ai = { ...base, item: 'rc car', item_key: 'rc_car', hard_constraints: ['rechargeable', 'size:m'] };
  const out = keepRulesFindings(ai, { ...rules, item_key: 'rc_car', hard_constraints: ['pieces:100'] });
  assert.deepEqual(sorted(out.hard_constraints), ['pieces:100', 'rechargeable', 'size:m']);
});

test('CX-01: AI with no constraints takes the rules constraint', () => {
  const out = keepRulesFindings({ ...base, item: 'cake', item_key: 'cake' }, rules);
  assert.deepEqual(out.hard_constraints, ['eggless']);
});

test('CX-01: duplicate AI constraints are deduped', () => {
  const out = keepRulesFindings({ ...base, item: 'cake', item_key: 'cake', hard_constraints: ['eggless', 'eggless'] }, rules);
  assert.deepEqual(out.hard_constraints, ['eggless']);
});

test('CX-01: AI item is kept when only constraints were lost', () => {
  const ai = { ...base, item: 'cake', item_key: 'cake', hard_constraints: ['sugar_free'] };
  const out = keepRulesFindings(ai, { ...rules, item: 'gift hamper', item_key: 'gift_hamper' });
  assert.equal(out.item_key, 'cake');
  assert.equal(out.item, 'cake');
  assert.deepEqual(sorted(out.hard_constraints), ['eggless', 'sugar_free']);
});

test('CX-02: sarvam rules drop negated rechargeable', () => {
  const r = extractRules('RC car rechargeable nahi chahiye under 1000 tomorrow', '2026-10-31');
  assert.ok(!r.hard_constraints.includes('rechargeable'));
  assert.equal(r.item, 'remote control car');
});

test('CX-02: sarvam rules treat bina cheeni as sugar_free', () => {
  assert.deepEqual(extractRules('bina cheeni cake', '2026-10-31').hard_constraints, ['sugar_free']);
});

test('CX-02: keepRulesFindings removes a constraint the customer negated', () => {
  const text = 'RC car rechargeable nahi chahiye under 1000 tomorrow';
  const ai = { ...base, item: 'rc car', item_key: 'rc_car', hard_constraints: ['rechargeable'], source_text: text };
  const out = keepRulesFindings(ai, { ...rules, item_key: 'rc_car', hard_constraints: [], source_text: text });
  assert.deepEqual(out.hard_constraints, []);
});

test('CX-02: keepRulesFindings never re-adds a negated rules constraint', () => {
  const text = 'cake eggless nahi chahiye';
  const out = keepRulesFindings({ ...base, item: 'cake', item_key: 'cake', source_text: text }, { ...rules, source_text: text });
  assert.deepEqual(out.hard_constraints, []);
});
