import test, { before } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'k'.repeat(16);
let requireMerchant: (req: Request) => Response | null;

before(async () => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:1';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(40);
  process.env.MERCHANT_KEY = `${KEY}\n`; // stray trailing newline
  ({ requireMerchant } = await import('./http'));
});

const withHeader = (v: string) => new Request('http://t/api/x', { headers: { 'x-merchant-key': v } });

test('header matches despite newline in env value', () => {
  assert.equal(requireMerchant(withHeader(KEY)), null);
});
test('?k= matches', () => {
  assert.equal(requireMerchant(new Request(`http://t/api/x?k=${KEY}`)), null);
});
test('padded header is trimmed', () => {
  assert.equal(requireMerchant(withHeader(`  ${KEY} `)), null);
});
test('wrong key is 401', () => {
  assert.equal(requireMerchant(withHeader('z'.repeat(16)))?.status, 401);
});
test('no key is 401', () => {
  assert.equal(requireMerchant(new Request('http://t/api/x'))?.status, 401);
});
test('whitespace-only header is 401', () => {
  assert.equal(requireMerchant(withHeader('   '))?.status, 401);
});
test('the 401 body does not contain the key', async () => {
  const res = requireMerchant(withHeader('z'.repeat(16)));
  assert.ok(res);
  assert.equal((await res.text()).includes(KEY), false);
});
