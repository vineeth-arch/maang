import { json, jsonError } from '@/lib/http';
import { getRequestWithToken, getRequestById, rpcText } from '@/lib/server/repo';
import { isUuid, notFound, safe } from '@/lib/server/route';
import type { CancelResponse } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return safe('cancel', async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const row = await getRequestWithToken(id, new URL(req.url).searchParams.get('t'));
    if (!row) return notFound();

    const result = await rpcText('release_unit', { p_request: id, p_reason: 'no_longer_needed' });
    if (result === 'not_allowed') return jsonError(409, 'conflict');
    const after = await getRequestById(id);
    const out: CancelResponse = { result, status: after?.status ?? row.status };
    return json(out);
  });
}
