import { demoStore } from '@/lib/demo';
import { clientIp, json } from '@/lib/http';
import { rateLimited } from './ratelimit';
import { getShop } from './repo';
import { buildBoard } from './board';
import { insightsFor } from './insights';

// Strip sensitive fields recursively, including masked phones. Also defend against
// credentials/contact details pasted into otherwise harmless free-text fields.
export function redactDemo(value: unknown, secrets = Object.values(process.env).filter((s): s is string => !!s && s.length >= 8)): unknown {
  if (Array.isArray(value)) return value.map(v => redactDemo(v, secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/phone|token|secret|password|merchant.?key|api.?key|authorization/i.test(key))
    .map(([key, v]) => [key, redactDemo(v, secrets)]));
  if (typeof value !== 'string') return value;
  let safe = value;
  for (const secret of secrets) safe = safe.split(secret).join('[redacted]');
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safe)) return safe;
  return safe.replace(/(?:\+?\d[ ()-]*){10,15}/g, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, match => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match) ? match : '[redacted]');
}

export async function demoRead(req: Request, slug: string, view: string): Promise<Response> {
  if (!demoStore(slug) || !['board', 'insights'].includes(view)) return json({ error: 'not_found' }, 404);
  if (rateLimited(`demo:${clientIp(req)}`, 120)) return Response.json({ error: 'rate_limited' }, {
    status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
  });
  try {
    const shop = await getShop(slug);
    if (!shop) return json({ error: 'not_found' }, 404);
    const data = view === 'board' ? await buildBoard(shop, true) : await insightsFor(shop, true);
    return json(redactDemo(data));
  } catch {
    // Never log database errors: they may contain user text or connection details.
    return json({ error: 'server_error' }, 500);
  }
}
