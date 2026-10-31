import test from 'node:test';
import assert from 'node:assert/strict';
import { telemetrySchema } from './schemas';

const valid = {
  stage: 'recording',
  error: 'no_audio',
  browser: 'safari',
  ctx_state: 'suspended',
  chunks: 0,
  duration_ms: 1000,
};

test('telemetrySchema: a valid body passes', () => {
  assert.equal(telemetrySchema.safeParse(valid).success, true);
});

test('telemetrySchema: an empty error string passes (upload start)', () => {
  assert.equal(telemetrySchema.safeParse({ ...valid, stage: 'upload', error: '' }).success, true);
});

test('telemetrySchema: extra field text is rejected', () => {
  assert.equal(telemetrySchema.safeParse({ ...valid, text: 'remote car chahiye' }).success, false);
});

test('telemetrySchema: error with a space is rejected', () => {
  assert.equal(telemetrySchema.safeParse({ ...valid, error: 'a b' }).success, false);
});

test('telemetrySchema: chunks 99999 is rejected', () => {
  assert.equal(telemetrySchema.safeParse({ ...valid, chunks: 99999 }).success, false);
});

test('telemetrySchema: negative duration_ms is rejected', () => {
  assert.equal(telemetrySchema.safeParse({ ...valid, duration_ms: -1 }).success, false);
});
