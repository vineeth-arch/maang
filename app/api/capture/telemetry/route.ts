import { clientIp, jsonError } from '@/lib/http';
import { rateLimited } from '@/lib/server/ratelimit';
import { readJson, safe } from '@/lib/server/route';
import { telemetrySchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return safe('telemetry', async () => {
    // ponytail: the limiter is per server instance, so the real cap scales with instance count. Fine for diagnostics.
    if (rateLimited('tel:' + clientIp(req), 20, 60_000)) return jsonError(429, 'rate_limited');
    const parsed = telemetrySchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, 'bad_request');
    // Only schema fields are logged: never the IP, user agent, audio, text or phone.
    console.info('[telemetry] ' + JSON.stringify(parsed.data));
    return new Response(null, { status: 204 });
  });
}
