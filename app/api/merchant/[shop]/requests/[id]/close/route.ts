import { json, jsonError } from '@/lib/http';
import { getRequestById, rpcText } from '@/lib/server/repo';
import { authShop } from '@/lib/server/merchant';
import { closeBodySchema } from '@/lib/server/schemas';
import { isUuid, notFound, readJson, safe } from '@/lib/server/route';
import type { CloseResponse } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ shop: string; id: string }> }) {
  return safe('close', async () => {
    const { shop: slug, id } = await params;
    const shop = await authShop(req, slug);
    if (shop instanceof Response) return shop;
    if (!isUuid(id)) return notFound();
    const parsed = closeBodySchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, 'bad_request');
    const row = await getRequestById(id);
    if (!row || row.shop_id !== shop.id) return notFound();
    const result = await rpcText('release_unit', { p_request: id, p_reason: parsed.data.reason });
    if (result === 'not_allowed') return jsonError(409, 'conflict');
    const after = await getRequestById(id);
    const out: CloseResponse = { result, status: after?.status ?? row.status };
    return json(out);
  });
}
