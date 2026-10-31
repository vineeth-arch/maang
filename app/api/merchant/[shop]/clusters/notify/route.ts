import { db } from '@/lib/db';
import { json, jsonError } from '@/lib/http';
import { todayIST, isExpired, matchProducts } from '@/lib/domain';
import { getProduct, rpcText } from '@/lib/server/repo';
import { authShop } from '@/lib/server/merchant';
import { notifyBodySchema } from '@/lib/server/schemas';
import { readJson, notFound, safe } from '@/lib/server/route';
import type { NotifyResponse, RequestRow } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ shop: string }> }) {
  return safe('notify', async () => {
    const { shop: slug } = await params;
    const shop = await authShop(req, slug);
    if (shop instanceof Response) return shop;
    const parsed = notifyBodySchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, 'bad_request');
    const { cluster_key, product_id } = parsed.data;

    const product = await getProduct(shop.id, product_id);
    if (!product) return notFound();
    if (product.stock_available <= 0) return jsonError(409, 'no_stock');

    const { data, error } = await db()
      .from('requests')
      .select('*')
      .eq('shop_id', shop.id)
      .eq('cluster_key', cluster_key)
      .eq('status', 'open')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`candidates: ${error.message}`);
    const today = todayIST();
    const candidates = ((data ?? []) as RequestRow[]).filter(
      (r) => !isExpired({ needed_by: r.needed_by, status: r.status }, today),
    );

    let skippedNoConsent = 0;
    let skippedIneligible = 0;
    const ids: string[] = [];
    for (const r of candidates) {
      if (!r.consent) {
        skippedNoConsent += 1;
        continue;
      }
      const m = matchProducts(
        { item_key: r.item_key ?? '', hard_constraints: r.hard_constraints ?? [], max_budget: r.max_budget },
        [product],
      );
      if (m.eligible.some((p) => p.id === product.id)) ids.push(r.id);
      else skippedIneligible += 1;
    }

    if (ids.length === 0 && skippedIneligible > 0) return jsonError(409, 'not_eligible');

    let notified = 0;
    if (ids.length > 0) notified = Number(await rpcText('notify_requests', { p_ids: ids, p_product: product.id }));
    const out: NotifyResponse = {
      notified_count: notified,
      skipped_no_consent: skippedNoConsent,
      skipped_ineligible: skippedIneligible,
    };
    return json(out);
  });
}
