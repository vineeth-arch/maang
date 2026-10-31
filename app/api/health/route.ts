import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  return json({ ok: true, time: new Date().toISOString() });
}
