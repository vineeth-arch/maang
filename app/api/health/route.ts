import { json } from '@/lib/http';
import { db } from '@/lib/db';
import type { HealthResponse } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MARKER_TIMEOUT_MS = 2000;

// The isolated test database holds a maang_env row with role 'test' (supabase/test-marker.sql); prod never has it.
// Any error, timeout or missing env means "no marker".
async function hasTestMarker(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const query = db().from('maang_env').select('role').eq('role', 'test').maybeSingle();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('marker timeout')), MARKER_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([Promise.resolve(query), timeout]);
    return !error && data?.role === 'test';
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function dbRole(): Promise<HealthResponse['db_role']> {
  try {
    const declared = process.env.MAANG_DB_ROLE;
    if (declared === 'test') return (await hasTestMarker()) ? 'test' : 'unknown';
    if (declared === 'prod') return 'prod';
  } catch {
    // fall through
  }
  return 'unknown';
}

export async function GET() {
  const body: HealthResponse = { ok: true, time: new Date().toISOString(), db_role: await dbRole() };
  return json(body);
}
