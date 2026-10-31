import { z } from 'zod';

if (typeof window !== 'undefined') {
  throw new Error('lib/env.ts is server-only and must never be imported in client code');
}

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  MERCHANT_KEY: z.string().min(16).optional(),
  RESET_KEY: z.string().min(16).optional(),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional().or(z.literal('')),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

// Lazy so `next build` works even when runtime secrets are absent at build time.
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid server env: ${names}`);
  }
  cached = parsed.data;
  return cached;
}
