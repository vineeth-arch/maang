import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { forgetMerchantKey, loadMerchantKey } from './key';
import { api } from './api';

const g = globalThis as unknown as { sessionStorage?: unknown; fetch: typeof fetch };
const realFetch = g.fetch;
const hadStorage = 'sessionStorage' in g;

function mapStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    m,
    getItem: (key: string) => m.get(key) ?? null,
    setItem: (key: string, v: string) => void m.set(key, v),
    removeItem: (key: string) => void m.delete(key),
  };
}

afterEach(() => {
  g.fetch = realFetch;
  if (!hadStorage) delete g.sessionStorage;
});

test('trims the URL key, returns it and stores it under mk:<shop>', () => {
  const s = mapStorage();
  g.sessionStorage = s;
  assert.equal(loadMerchantKey('shop-trim', '  abc  '), 'abc');
  assert.equal(s.m.get('mk:shop-trim'), 'abc');
});

test('no URL key falls back to the stored key', () => {
  g.sessionStorage = mapStorage({ 'mk:shop-stored': 'xyz' });
  assert.equal(loadMerchantKey('shop-stored', null), 'xyz');
  assert.equal(loadMerchantKey('shop-stored', '   '), 'xyz');
});

test('nothing anywhere returns empty string', () => {
  g.sessionStorage = mapStorage();
  assert.equal(loadMerchantKey('shop-none', undefined), '');
});

test('throwing storage still works via memory', () => {
  const boom = () => {
    throw new Error('blocked');
  };
  g.sessionStorage = { getItem: boom, setItem: boom, removeItem: boom };
  assert.equal(loadMerchantKey('shop-throw', ' k1 '), 'k1');
  assert.equal(loadMerchantKey('shop-throw', ''), 'k1');
});

test('forgetMerchantKey clears storage and memory', () => {
  const s = mapStorage();
  g.sessionStorage = s;
  loadMerchantKey('shop-forget', 'k2');
  forgetMerchantKey('shop-forget');
  assert.equal(s.m.has('mk:shop-forget'), false);
  assert.equal(loadMerchantKey('shop-forget', null), '');
});

test('forgetMerchantKey does not throw when storage throws', () => {
  const boom = () => {
    throw new Error('blocked');
  };
  g.sessionStorage = { getItem: boom, setItem: boom, removeItem: boom };
  loadMerchantKey('shop-forget-throw', 'k3');
  forgetMerchantKey('shop-forget-throw');
  assert.equal(loadMerchantKey('shop-forget-throw', null), '');
});

test('undefined sessionStorage works via memory', () => {
  delete g.sessionStorage;
  assert.equal(loadMerchantKey('shop-nostorage', 'k4'), 'k4');
  assert.equal(loadMerchantKey('shop-nostorage', null), 'k4');
  forgetMerchantKey('shop-nostorage');
  assert.equal(loadMerchantKey('shop-nostorage', null), '');
});

test('api() sends the key as a header and never in the URL', async () => {
  let seen: { url: string; headers: Headers } | null = null;
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen = { url: String(input), headers: new Headers(init?.headers) };
    return Response.json({ ok: true });
  }) as typeof fetch;
  await api('/api/merchant/s/board', 'secret');
  assert.ok(seen);
  const r = seen as { url: string; headers: Headers };
  assert.equal(r.url, '/api/merchant/s/board');
  assert.equal(r.url.includes('k='), false);
  assert.equal(r.headers.get('x-merchant-key'), 'secret');
});

test('api() on a demo path sends no key header and no query', async () => {
  let seen: { url: string; headers: Headers } | null = null;
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen = { url: String(input), headers: new Headers(init?.headers) };
    return Response.json({ ok: true });
  }) as typeof fetch;
  await api('/api/demo/board/neighbourhood-toys', 'ignored');
  const r = seen as unknown as { url: string; headers: Headers };
  assert.equal(r.url, '/api/demo/board/neighbourhood-toys');
  assert.equal(r.headers.has('x-merchant-key'), false);
});

test('api() still refuses POST on demo paths', async () => {
  await assert.rejects(() => api('/api/demo/board/x', '', { a: 1 }), { status: 403 });
});
