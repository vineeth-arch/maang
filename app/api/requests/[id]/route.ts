import { json } from '@/lib/http';
import { todayIST, isExpired } from '@/lib/domain';
import { getRequestWithToken, getShopById, getProductById } from '@/lib/server/repo';
import { isUuid, notFound, safe } from '@/lib/server/route';
import type { CustomerView } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return safe('request_view', async () => {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const row = await getRequestWithToken(id, new URL(req.url).searchParams.get('t'));
    if (!row) return notFound();
    const shop = await getShopById(row.shop_id);
    let product: CustomerView['product'] = null;
    if (['notified', 'reserved', 'picked_up'].includes(row.status) && row.matched_product_id) {
      const p = await getProductById(row.matched_product_id);
      if (p) product = { name: p.name, price: p.price };
    }
    const view: CustomerView = {
      id: row.id,
      shop_name: shop?.name ?? '',
      item_label: row.item_label,
      source_text: row.source_text,
      status: row.status,
      close_reason: row.close_reason,
      expired: isExpired({ needed_by: row.needed_by, status: row.status }, todayIST()),
      needed_by: row.needed_by,
      product,
      created_at: row.created_at,
    };
    return json(view);
  });
}
