import test from 'node:test';
import assert from 'node:assert/strict';
import { newRequestText, notifiedText } from './soundbox';

test('newRequestText with label and budget', () => {
  assert.equal(newRequestText('RC car', 1000), 'Nayi maang: RC car, 1000 rupaye tak');
});

test('newRequestText drops budget clause when null', () => {
  assert.equal(newRequestText('RC car', null), 'Nayi maang: RC car');
});

test('newRequestText falls back for null or blank label', () => {
  assert.equal(newRequestText(null, 500), 'Nayi maang aayi');
  assert.equal(newRequestText('   ', 500), 'Nayi maang aayi');
});

test('newRequestText truncates long label but keeps budget tail', () => {
  const out = newRequestText('x'.repeat(300), 500);
  assert.ok(out.length <= 120, `length ${out.length}`);
  assert.ok(out.endsWith(', 500 rupaye tak'));
});

test('notifiedText', () => {
  assert.equal(notifiedText(3), '3 customers ko bata diya gaya.');
});
