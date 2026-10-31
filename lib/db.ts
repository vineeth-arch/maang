import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

if (typeof window !== 'undefined') {
  throw new Error('lib/db.ts is server-only and must never be imported in client code');
}

let client: SupabaseClient | null = null;

// Service-role client. Server code only. Fetch forced to no-store so Next never serves stale rows.
export function db(): SupabaseClient {
  if (client) return client;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
  return client;
}
