import { db } from '@/lib/db';
import {
  todayIST,
  isExpired,
  clusterLabel,
  matchProducts,
  maskPhone,
} from '@/lib/domain';
import type {
  BoardRequest,
  BoardResponse,
  Cluster,
  Metrics,
  Product,
  RequestRow,
  UrgentItem,
} from '@/lib/api-types';
import { getProducts, getShopRequests, type Shop } from './repo';

export function toBoardRequest(r: RequestRow, expired: boolean): BoardRequest {
  return {
    id: r.id,
    source_text: r.source_text,
    item_label: r.item_label,
    item_key: r.item_key,
    hard_constraints: r.hard_constraints ?? [],
    max_budget: r.max_budget,
    needed_by: r.needed_by,
    needed_by_label: r.extraction?.needed_by_label ?? null,
    urgent: r.urgent,
    consent: r.consent,
    phone_masked: r.consent ? maskPhone(r.phone) : null,
    status: r.status,
    close_reason: r.close_reason,
    expired,
    extraction_mode: r.extraction_mode,
    matched_product_id: r.matched_product_id,
    synthetic: r.synthetic,
    created_at: r.created_at,
  };
}

// Bucket is the last segment of the cluster key. Upper bound is its number; 'any' and '5000+' mean no cap.
export function bucketOf(key: string): string {
  const parts = key.split('|');
  return parts[parts.length - 1] ?? 'any';
}

export function bucketUpperBound(bucket: string): number | null {
  if (bucket === 'any' || bucket.includes('+')) return null;
  const m = bucket.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function loadMetrics(shopId: string): Promise<Metrics> {
  const sets: Record<keyof Metrics, Set<string>> = {
    captured: new Set(),
    notified: new Set(),
    reserved: new Set(),
    picked_up: new Set(),
  };
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await db()
      .from('events')
      .select('request_id, type')
      .eq('shop_id', shopId)
      .in('type', ['captured', 'notified', 'reserved', 'picked_up'])
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`events: ${error.message}`);
    const rows = (data ?? []) as Array<{ request_id: string | null; type: keyof Metrics }>;
    for (const e of rows) {
      if (e.request_id && sets[e.type]) sets[e.type].add(e.request_id);
    }
    if (rows.length < pageSize) break;
  }
  return {
    captured: sets.captured.size,
    notified: sets.notified.size,
    reserved: sets.reserved.size,
    picked_up: sets.picked_up.size,
  };
}

const ACTIVE = new Set(['open', 'notified', 'reserved']);

export async function buildBoard(shop: Shop, syntheticOnly = false): Promise<BoardResponse> {
  const today = todayIST();
  const [allProducts, allRequests, metrics] = await Promise.all([
    getProducts(shop.id),
    getShopRequests(shop.id),
    loadMetrics(shop.id),
  ]);

  const products = syntheticOnly ? allProducts.filter(p => p.synthetic) : allProducts;
  const requests = syntheticOnly ? allRequests.filter(r => r.synthetic) : allRequests;

  const expiredList: BoardRequest[] = [];
  const urgent: UrgentItem[] = [];
  const unclustered: BoardRequest[] = [];
  const groups = new Map<string, RequestRow[]>();

  for (const r of requests) {
    const expired = isExpired({ needed_by: r.needed_by, status: r.status }, today);
    if (expired) {
      expiredList.push(toBoardRequest(r, true));
      continue;
    }
    if (!ACTIVE.has(r.status)) continue;
    if (r.urgent) {
      const alternatives: Product[] = r.item_key
        ? products.filter((p) => p.item_key === r.item_key && p.stock_available > 0)
        : [];
      urgent.push({ ...toBoardRequest(r, false), alternatives });
      continue;
    }
    if (!r.cluster_key) {
      unclustered.push(toBoardRequest(r, false));
      continue;
    }
    const g = groups.get(r.cluster_key);
    if (g) g.push(r);
    else groups.set(r.cluster_key, [r]);
  }

  const clusters: Cluster[] = [];
  for (const [key, rows] of groups) {
    const first = rows[0];
    const bucket = bucketOf(key);
    const itemKey = first.item_key ?? '';
    const { eligible, rejected } = matchProducts(
      { item_key: itemKey, hard_constraints: first.hard_constraints ?? [], max_budget: bucketUpperBound(bucket) },
      products,
    );
    const dates = rows.map((r) => r.needed_by).filter((d): d is string => !!d).sort();
    clusters.push({
      key,
      label: clusterLabel(itemKey, first.hard_constraints ?? [], bucket),
      item_key: itemKey,
      count_active: rows.length,
      count_consenting: rows.filter((r) => r.status === 'open' && r.consent).length,
      earliest_needed_by: dates[0] ?? null,
      requests: rows.map((r) => toBoardRequest(r, false)),
      eligible,
      rejected,
      in_stock_alternatives: rejected.filter((x) => x.product.stock_available > 0),
    });
  }
  clusters.sort((a, b) => {
    if (b.count_active !== a.count_active) return b.count_active - a.count_active;
    if (a.earliest_needed_by === b.earliest_needed_by) return 0;
    if (!a.earliest_needed_by) return 1;
    if (!b.earliest_needed_by) return -1;
    return a.earliest_needed_by < b.earliest_needed_by ? -1 : 1;
  });

  return {
    shop: { slug: shop.slug, name: shop.name },
    clusters,
    urgent,
    unclustered,
    expired: expiredList,
    products,
    metrics,
    server_time: new Date().toISOString(),
    today,
  };
}
