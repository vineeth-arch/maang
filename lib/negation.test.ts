import { test } from 'node:test';
import assert from 'node:assert/strict';
import { negatedConstraints } from './negation';

test('hinglish nahi chahiye negates rechargeable', () => {
  assert.deepEqual(negatedConstraints('RC car rechargeable nahi chahiye under 1000 tomorrow'), ['rechargeable']);
});

test('english and devanagari negations of rechargeable', () => {
  for (const t of ['not rechargeable', 'non-rechargeable', 'without rechargeable', 'रिचार्जेबल नहीं चाहिए']) {
    assert.deepEqual(negatedConstraints(t), ['rechargeable'], t);
  }
});

test('"nahi hai" is the shop talking, not a customer negation', () => {
  assert.deepEqual(negatedConstraints('rechargeable nahi hai'), []);
});

test('sugar free spellings and bina cheeni are positive, never negated', () => {
  for (const t of ['bina cheeni wala cake', 'sugar free cake', 'sugarless cake', 'bina cheeni sugar free cake', 'bina shakkar sugar-free cake']) {
    assert.deepEqual(negatedConstraints(t), [], t);
  }
});

test('"battery wala nahi" is a positive rechargeable phrase', () => {
  assert.deepEqual(negatedConstraints('battery wala nahi, charging wala'), []);
  assert.deepEqual(negatedConstraints('rechargeable battery wala nahi'), []);
});

test('negation only applies to the keyword it sits next to', () => {
  assert.deepEqual(negatedConstraints('rechargeable chahiye, cell wala nahi chahiye'), ['disposable_batteries']);
  assert.deepEqual(negatedConstraints('rechargeable cell wala nahi'), ['disposable_batteries']);
});

test('eggless nahi chahiye', () => {
  assert.deepEqual(negatedConstraints('eggless nahi chahiye'), ['eggless']);
});

test('empty and unrelated text', () => {
  assert.deepEqual(negatedConstraints(''), []);
  assert.deepEqual(negatedConstraints('remote wali gaadi chahiye, rechargeable, 1000 ke andar, kal tak'), []);
});

test('result is sorted and unique', () => {
  assert.deepEqual(negatedConstraints('not sugar free, eggless nahi, not eggless'), ['eggless', 'sugar_free']);
});
