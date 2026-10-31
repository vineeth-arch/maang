import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';
import type { ErrorCode } from './api-types';

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export function jsonError(status: number, code: ErrorCode, error?: string): Response {
  return json({ error: error ?? code, code }, status);
}

// Constant-time compare. Hashing first makes lengths equal so timingSafeEqual never throws.
export function safeEqual(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function newToken(): string {
  return randomBytes(24).toString('base64url');
}

// Merchant auth: ?k= or x-merchant-key header must equal MERCHANT_KEY. Returns a 401 Response, or null when allowed.
export function requireMerchant(req: Request): Response | null {
  const url = new URL(req.url);
  const provided = url.searchParams.get('k') ?? req.headers.get('x-merchant-key');
  const expected = env().MERCHANT_KEY;
  if (!safeEqual(provided, expected)) return jsonError(401, 'unauthorized');
  return null;
}

export function requireReset(req: Request): Response | null {
  const expected = env().RESET_KEY;
  if (!safeEqual(req.headers.get('x-reset-key'), expected)) return jsonError(401, 'unauthorized');
  return null;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

export function baseUrl(req: Request): string {
  const fromEnv = env().NEXT_PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
