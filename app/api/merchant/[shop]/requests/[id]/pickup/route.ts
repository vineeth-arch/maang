import { json, jsonError } from '@/lib/http';
import { getRequestById, rpcText } from '@/lib/server/repo';
import { authShop } from '@/lib/server/merchant';
import { isUuid, notFound, safe } from '@/lib/server/route';
import type { PickupResponse } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ shop: string; id: string }> }) {
  return safe('pickup', async () => {
    const { shop: slug, id } = await params;
    const shop = await authShop(req, slug);
    if (shop instanceof Response) return shop;
    if (!isUuid(id)) return notFound();
    const row = await getRequestById(id);
    if (!row || row.shop_id !== shop.id) return notFound();
    const result = await rpcText('mark_pickup', { p_request: id });
    if (result === 'not_reserved') return jsonError(409, 'conflict');
    if (result !== 'ok' && result !== 'already') throw new Error('unexpected pickup result');
    const out: PickupResponse = { result };
    return json(out);
  });
}
