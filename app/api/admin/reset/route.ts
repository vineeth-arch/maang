import { db } from '@/lib/db';
import { json, requireReset } from '@/lib/http';
import { safe } from '@/lib/server/route';
import type { ResetResponse } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  return safe('reset', async () => {
    const denied = requireReset(req);
    if (denied) return denied;
    const { data, error } = await db().rpc('reset_demo');
    if (error) throw new Error(`reset_demo: ${error.message}`);
    const out: ResetResponse = { ok: true, counts: data as ResetResponse['counts'] };
    return json(out);
  });
}
