import { json, jsonError } from '@/lib/http';
import { getRequestWithToken, getRequestById, rpcText } from '@/lib/server/repo';
import { isUuid, notFound, safe } from '@/lib/server/route';
import type { ReserveResponse, ReserveResult } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return safe('reserve', async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const row = await getRequestWithToken(id, new URL(req.url).searchParams.get('t'));
    if (!row) return notFound();

    const result = await rpcText('reserve_unit', { p_request: id });
    const after = await getRequestById(id);
    const status = after?.status ?? row.status;

    if (result === 'not_notified') {
      if (status === 'reserved') {
        const out: ReserveResponse = { result: 'already', status };
        return json(out);
      }
      return jsonError(409, 'conflict');
    }
    if (result !== 'ok' && result !== 'already' && result !== 'out_of_stock') {
      throw new Error('unexpected reserve result');
    }
    const out: ReserveResponse = { result: result as ReserveResult, status };
    return json(out);
  });
}
