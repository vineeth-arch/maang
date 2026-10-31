import { json, jsonError } from '@/lib/http';
import { getProduct, rpcText } from '@/lib/server/repo';
import { authShop } from '@/lib/server/merchant';
import { stockBodySchema } from '@/lib/server/schemas';
import { readJson, notFound, safe } from '@/lib/server/route';
import type { StockResponse } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ shop: string }> }) {
  return safe('stock', async () => {
    const { shop: slug } = await params;
    const shop = await authShop(req, slug);
    if (shop instanceof Response) return shop;
    const parsed = stockBodySchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, 'bad_request');
    const { product_id, add_quantity } = parsed.data;
    if (!(await getProduct(shop.id, product_id))) return notFound();
    await rpcText('add_stock', { p_shop: shop.id, p_product: product_id, p_qty: add_quantity });
    const product = await getProduct(shop.id, product_id);
    if (!product) return notFound();
    const out: StockResponse = { product };
    return json(out);
  });
}
