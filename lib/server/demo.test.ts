import test from 'node:test';
import assert from 'node:assert/strict';
import { demoRead, redactDemo } from './demo';
import { DEMO_STORES, demoSlug, demoStore, merchantHref, merchantRead } from '../demo';
import { rateLimited } from './ratelimit';
import { requireMerchant, safeEqual } from '../http';

// Inert credentials only: these tests never read or mutate the shared database.
process.env.SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-role-value';
process.env.MERCHANT_KEY = 'test-only-merchant-key-value';

test('single allowlist maps both stores; unknown and prototype names rejected', () => {
  assert.deepEqual(Object.values(DEMO_STORES), ['neighbourhood-toys', 'electronics-andheri']);
  for (const slug of Object.values(DEMO_STORES)) assert.ok(demoStore(slug));
  for (const bad of ['elsewhere', 'constructor', '__proto__', 'toString']) {
    assert.equal(demoSlug(bad), null);
    assert.equal(demoStore(bad), null);
  }
});
test('every demo API view rejects non-allowlisted slugs before any DB read', async () => {
  for (const view of ['board', 'insights', 'settings', 'notify', 'reserve', 'pickup', 'close', 'reset', 'speak']) {
    assert.equal((await demoRead(new Request('http://local/api/demo'), 'outside-allowlist', view)).status, 404);
  }
  assert.equal((await demoRead(new Request('http://local'), DEMO_STORES.toys, 'settings')).status, 404);
});
test('deep redaction removes phones, masked phones, tokens, keys and embedded secrets', () => {
  const secret = 'test-only-secret-value';
  const payload = { phone: '9876543210', phone_masked: '******3210', token: 'opaque', merchant_key: secret,
    nested: [{ source_text: `Call +91 98765 43210 with ${secret}`, authorization: secret,
      text: 'opaque_credential_abcdefghijklmnopqrstuvwxyz12345678', price: 45000 }],
    id: '123e4567-e89b-42d3-a456-426614174000' };
  const result = redactDemo(payload, [secret]) as Record<string, unknown>;
  const output = JSON.stringify(result);
  for (const forbidden of ['98765', '3210', secret, 'opaque', 'phone', 'token', 'merchant_key', 'authorization']) {
    assert.equal(output.includes(forbidden), false, `redaction failed for field category`);
  }
  assert.equal(result.id, payload.id);
  assert.ok(output.includes('45000'));
});
test('demo read limiter returns 429 with retry guidance before database access', async () => {
  const ip = 'demo-unit-test';
  for (let i = 0; i < 120; i++) assert.equal(rateLimited(`demo:${ip}`, 120), false);
  const r = await demoRead(new Request('http://local', { headers: { 'x-forwarded-for': ip } }), DEMO_STORES.toys, 'board');
  assert.equal(r.status, 429);
  assert.equal(r.headers.get('retry-after'), '60');
});
test('limiter window expires and isolates clients', () => {
  assert.equal(rateLimited('window-test', 1, 60000, 0), false);
  assert.equal(rateLimited('window-test', 1, 60000, 59999), true);
  assert.equal(rateLimited('another-test', 1, 60000, 59999), false);
  assert.equal(rateLimited('window-test', 1, 60000, 60000), false);
});
test('real merchant auth still rejects absent and wrong key, constant-time helper unchanged', () => {
  assert.equal(requireMerchant(new Request('http://local/api/merchant/shop/board'))?.status, 401);
  assert.equal(requireMerchant(new Request('http://local/api/merchant/shop/board?k=wrong'))?.status, 401);
  assert.equal(safeEqual('same', 'same'), true);
  assert.equal(safeEqual('short', 'different-length'), false);
});
test('demo links and API paths never carry keys', () => {
  for (const slug of Object.values(DEMO_STORES)) {
    for (const view of ['board', 'insights', 'settings'] as const) {
      const path = merchantHref(slug, 'must-not-escape', view, true);
      assert.ok(path.startsWith('/demo/'));
      assert.equal(path.includes('?'), false);
    }
    assert.equal(merchantRead(slug, 'board', true), `/api/demo/board/${slug}`);
  }
});
