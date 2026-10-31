import { db } from '@/lib/db';
import { buildInsights, tierFor, type DemandEvent, type Insights, type Tier } from '@/lib/insights-entry';
import { BANDS, MODULES, type BandId } from '@/lib/tier-bands';
import { getShopRequests, type Shop } from './repo';

// ponytail: profile and synthetic history live as events rows (types 'profile', 'demand') because this lane
// has no DDL access to the demo database. Move to shop columns / a history table when a migration can run.

export type Profile = { annual_revenue_band: BandId; locations: number; tier: Tier };
export type InsightsResponse = { shop: { slug: string; name: string }; profile: Profile; modules: string[]; insights: Insights };

const STORE2_SLUG = 'electronics-andheri';
const SEED_PROFILES: Record<string, Profile> = {
  [STORE2_SLUG]: { annual_revenue_band: 'over_50cr', locations: 3, tier: 'very_large' },
  'neighbourhood-toys': { annual_revenue_band: 'under_40l', locations: 1, tier: 'small' },
};

export function profileFor(band: BandId, locations: number): Profile {
  const v = BANDS.find((b) => b.id === band)?.value ?? 0;
  return { annual_revenue_band: band, locations, tier: tierFor(v, locations) };
}

export async function getProfile(shop: Shop): Promise<Profile> {
  const { data, error } = await db()
    .from('events')
    .select('payload')
    .eq('shop_id', shop.id)
    .eq('type', 'profile')
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw new Error(`profile: ${error.message}`);
  const p = (data?.[0]?.payload ?? null) as Profile | null;
  return p ?? SEED_PROFILES[shop.slug] ?? { annual_revenue_band: 'under_40l', locations: 1, tier: 'small' };
}

export async function saveProfile(shop: Shop, p: Profile): Promise<void> {
  const { error } = await db().from('events').insert({ shop_id: shop.id, request_id: null, type: 'profile', payload: p });
  if (error) throw new Error(`profile save: ${error.message}`);
}

type HistoryPayload = Omit<DemandEvent, 'created_at'> & { synthetic: true };

async function loadEvents(shop: Shop): Promise<DemandEvent[]> {
  const since = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const { data, error } = await db()
    .from('events')
    .select('payload, created_at')
    .eq('shop_id', shop.id)
    .eq('type', 'demand')
    .gte('created_at', since)
    .limit(5000);
  if (error) throw new Error(`demand: ${error.message}`);
  const history = (data ?? []).map((r) => ({ ...(r.payload as HistoryPayload), created_at: r.created_at as string }));
  const cat = new Map(history.map((h) => [h.item_key, h.category]));
  const live: DemandEvent[] = (await getShopRequests(shop.id))
    .filter((r) => r.item_key)
    .map((r) => ({
      item_key: r.item_key as string,
      item_label: r.item_label ?? (r.item_key as string),
      category: cat.get(r.item_key as string) ?? null,
      created_at: r.created_at,
      max_budget: r.max_budget,
      urgent: r.urgent,
      status: r.status,
    }));
  return [...history, ...live];
}

export async function insightsFor(shop: Shop): Promise<InsightsResponse> {
  const [profile, events] = await Promise.all([getProfile(shop), loadEvents(shop)]);
  return {
    shop: { slug: shop.slug, name: shop.name },
    profile,
    modules: MODULES[profile.tier],
    insights: buildInsights(events, { today: new Date(), tier: profile.tier }),
  };
}

// ---------- seed (called by the reset route after reset_demo) ----------

type Spec = { key: string; label: string; category: string; base: number; spread: number; perDay: (d: number) => number; store?: (d: number, k: number) => string };
const HOURS = [11, 13, 15, 17, 18, 19, 19, 20, 20, 21];
const STORES: Record<string, string> = { andheri: 'Andheri', powai: 'Powai', noida: 'Noida' };
const ROT = ['andheri', 'powai', 'noida'];
const rot = (d: number, k: number) => ROT[(d + k) % 3];

const S1: Spec[] = [
  { key: 'rc_car', label: 'Rechargeable RC car', category: 'toys', base: 800, spread: 400, perDay: (d) => (d <= 7 ? 3 : d % 3 === 0 ? 1 : 0) },
  { key: 'gift_hamper', label: 'Diwali gift hamper', category: 'gifts', base: 400, spread: 200, perDay: (d) => (d <= 7 ? 2 : d % 4 === 0 ? 1 : 0) },
  { key: 'cricket_bat', label: 'Cricket bat', category: 'sports', base: 600, spread: 600, perDay: (d) => (d % 2 === 0 ? 1 : 0) },
  { key: 'camera_drone', label: 'Camera drone', category: 'toys', base: 3000, spread: 1, perDay: (d) => (d === 18 ? 1 : 0) },
];
const S2: Spec[] = [
  { key: 'tv', label: 'Smart TV 43 inch', category: 'electronics', base: 30000, spread: 30000, perDay: (d) => (d <= 7 ? 4 : 1), store: rot },
  { key: 'samsung_galaxy', label: 'Samsung Galaxy phone', category: 'electronics', base: 15000, spread: 15000, perDay: (d) => (d <= 7 ? 3 : d % 2 === 0 ? 1 : 0), store: rot },
  { key: 'earbuds', label: 'Wireless earbuds', category: 'accessories', base: 1500, spread: 1500, perDay: () => 2, store: rot },
  // Laptops: Noida 2 a day, Powai every 2nd day, Andheri every 3rd day.
  { key: 'laptop', label: 'Laptop', category: 'computers', base: 50000, spread: 30000, perDay: (d) => 2 + (d % 2 === 0 ? 1 : 0) + (d % 3 === 0 ? 1 : 0), store: (d, k) => (k <= 2 ? 'noida' : k === 3 && d % 2 === 0 ? 'powai' : 'andheri') },
];

function history(shopId: string, specs: Spec[], todayISO: string) {
  const midnight = Date.parse(`${todayISO}T00:00:00+05:30`);
  const rows: Array<{ shop_id: string; request_id: null; type: 'demand'; payload: HistoryPayload; created_at: string }> = [];
  for (const s of specs) {
    for (let d = 1; d <= 30; d++) {
      for (let k = 1; k <= s.perDay(d); k++) {
        const h = HOURS[(d * 3 + k * 7) % 10];
        const m = (d * 11 + k * 17) % 60;
        const sid = s.store?.(d, k) ?? null;
        rows.push({
          shop_id: shopId,
          request_id: null,
          type: 'demand',
          payload: {
            item_key: s.key,
            item_label: s.label,
            category: s.category,
            max_budget: s.base + Math.round(((d * 37 + k * 53) % s.spread) / 100) * 100,
            urgent: (d + k) % 9 === 0,
            status: 'closed',
            store_id: sid,
            store_label: sid ? STORES[sid] : null,
            synthetic: true,
          },
          created_at: new Date(midnight - d * 86_400_000 + h * 3_600_000 + m * 60_000).toISOString(),
        });
      }
    }
  }
  return rows;
}

export async function seedInsights(): Promise<{ demand: number }> {
  const c = db();
  const { data: s1, error: e1 } = await c.from('shops').select('id').eq('slug', 'neighbourhood-toys').single();
  if (e1) throw new Error(`store1: ${e1.message}`);
  const id = s1.id as string;
  const { error: ed } = await c.from('events').delete().eq('shop_id', id).in('type', ['demand', 'profile']);
  if (ed) throw new Error(`seed clear: ${ed.message}`);
  const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const rows = [
    ...history(id, S1, today),
    { shop_id: id, request_id: null, type: 'profile' as const, payload: SEED_PROFILES['neighbourhood-toys'], created_at: new Date().toISOString() },
  ];
  const { error: ei } = await c.from('events').insert(rows);
  if (ei) throw new Error(`seed insert: ${ei.message}`);
  return { demand: rows.length - 1 };
}

// Store 2 (electronics-andheri) catalog and live requests are seeded by lib/server/store2.ts.
// This adds only its 30-day branch history and very_large profile; call after resetStore2(), which clears its events.
export async function seedStore2History(): Promise<{ demand: number }> {
  const c = db();
  const { data: shop, error: es } = await c.from('shops').select('id').eq('slug', STORE2_SLUG).single();
  if (es) throw new Error(`store2: ${es.message}`);
  const id = shop.id as string;
  const { error: ed } = await c.from('events').delete().eq('shop_id', id).in('type', ['demand', 'profile']);
  if (ed) throw new Error(`store2 clear: ${ed.message}`);
  const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const rows = [
    ...history(id, S2, today),
    { shop_id: id, request_id: null, type: 'profile' as const, payload: SEED_PROFILES[STORE2_SLUG], created_at: new Date().toISOString() },
  ];
  const { error: ei } = await c.from('events').insert(rows);
  if (ei) throw new Error(`store2 history: ${ei.message}`);
  return { demand: rows.length - 1 };
}
