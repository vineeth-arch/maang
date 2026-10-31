import { db } from '@/lib/db';
import { json, requireReset } from '@/lib/http';
import { safe } from '@/lib/server/route';
import { seedInsights, seedStore2History } from '@/lib/server/insights';
import type { ResetResponse } from '@/lib/api-types';
import { resetStore2 } from '@/lib/server/store2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  return safe('reset', async () => {
    const denied = requireReset(req);
    if (denied) return denied;
    const { data, error } = await db().rpc('reset_demo');
    if (error) throw new Error(`reset_demo: ${error.message}`);
    // Insights history and store 2 must never make store 1's reset fail; failures are logged.
    const warn = (step: string, e: unknown) => console.error(`[api] reset: ${step} failed:`, e instanceof Error ? e.message : 'unknown');
    try {
      await seedInsights();
    } catch (e) {
      warn('store 1 insights seed', e);
    }
    let store2: Awaited<ReturnType<typeof resetStore2>> | null = null;
    try {
      store2 = await resetStore2();
    } catch (e) {
      warn('store 2 reset', e);
    }
    if (store2) {
      try {
        await seedStore2History();
      } catch (e) {
        warn('store 2 history seed', e);
      }
    }
    const out: ResetResponse = { ok: true, counts: data as ResetResponse['counts'], store2 };
    return json(out);
  });
}
