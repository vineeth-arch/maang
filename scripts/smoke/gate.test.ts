import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gate } from './gate';

const D = { destructive: true, demoDb: false };

test('non-destructive is readonly even on prod', () => {
  assert.equal(gate('prod', { destructive: false, demoDb: false }), 'readonly');
});
test('test db runs destructive', () => {
  assert.equal(gate('test', D), 'run');
});
test('prod without demo flag is refused', () => {
  assert.equal(gate('prod', D), 'refuse');
});
test('prod with demo flag warns', () => {
  assert.equal(gate('prod', { destructive: true, demoDb: true }), 'warn');
});
test('unknown role is refused', () => {
  assert.equal(gate('unknown', D), 'refuse');
});
test('missing role is refused', () => {
  assert.equal(gate(undefined, D), 'refuse');
});
test('test role ignores demo flag', () => {
  assert.equal(gate('test', { destructive: true, demoDb: true }), 'run');
});
