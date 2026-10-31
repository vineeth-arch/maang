import { jsonError } from '@/lib/http';

// Wraps a handler so no error ever escapes as a stack trace. Logs a short message only.
export async function safe(name: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[api] ${name} failed:`, e instanceof Error ? e.message.slice(0, 200) : 'unknown');
    return jsonError(500, 'server_error');
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function notFound(): Response {
  return jsonError(404, 'not_found');
}
