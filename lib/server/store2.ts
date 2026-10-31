import { db } from '@/lib/db';
import { addDaysISO, todayIST } from '@/lib/domain/time';
import { clusterKey } from '@/lib/domain/cluster';
import { newToken } from '@/lib/http';
import type { ResetCounts } from '@/lib/api-types';

// Second demo store, fictional electronics chain branch. All rows synthetic.
// Seeded here (after reset_demo() reseeds store 1) so the live reset_demo() SQL function stays unchanged.
export const STORE2 = { slug: 'electronics-andheri', name: 'Galaxy Digital, Andheri' };

type Seed = {
  text: string; lang: string; item: string; key: string; hard: string[]; budget: number | null;
  due: string | null; label: string | null; urgent?: boolean; phone: string | null; ago: number;
  closed?: 'cannot_meet_deadline';
};

function seeds(today: string): Seed[] {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const sunday = addDaysISO(today, (7 - dow) % 7);
  const monday = addDaysISO(today, ((8 - dow) % 7) || 7);
  const tomorrow = addDaysISO(today, 1);
  const phone = { item: 'Samsung Galaxy phone, 256 GB, blue', key: 'samsung_galaxy', hard: ['256_gb', 'color:blue'], budget: null };
  const tv = { item: '55 inch TV with wall mount', key: 'tv', hard: ['size:55_inch', 'wall_mount'], budget: 45000 };
  const buds = { item: 'noise cancelling earbuds', key: 'earbuds', hard: ['noise_cancelling'], budget: 3000 };
  const laptop = { item: 'laptop, 16 GB RAM, for college', key: 'laptop', hard: ['16_gb_ram'], budget: 60000 };
  return [
    { ...phone, text: 'Samsung Galaxy 256 GB blue chahiye, kal tak', lang: 'hi-IN', due: tomorrow, label: 'kal tak', phone: '9000000201', ago: 95 },
    { ...phone, text: 'Galaxy phone blue colour, 256 GB, kal chahiye', lang: 'hi-IN', due: tomorrow, label: 'kal', phone: '9000000202', ago: 80 },
    { ...phone, text: 'Samsung Galaxy 256GB blue, is week', lang: 'hi-IN', due: addDaysISO(today, 3), label: 'is week', phone: '9000000203', ago: 70 },
    { ...phone, text: 'Blue Samsung Galaxy with 256 GB storage', lang: 'en-IN', due: addDaysISO(today, 5), label: null, phone: null, ago: 60 },
    { ...phone, text: 'Galaxy 256 GB blue wala hai kya?', lang: 'hi-IN', due: null, label: null, phone: '9000000204', ago: 45 },
    { ...phone, text: 'Samsung Galaxy, 256 GB, blue chahiye', lang: 'hi-IN', due: null, label: null, phone: null, ago: 20 },
    { ...tv, text: '55 inch TV 45000 ke andar, wall mount ke saath, Sunday delivery', lang: 'hi-IN', due: sunday, label: 'Sunday', phone: '9000000205', ago: 90 },
    { ...tv, text: '55 inch TV with wall mount under 45000, deliver Sunday', lang: 'en-IN', due: sunday, label: 'Sunday', phone: '9000000206', ago: 75 },
    { ...tv, text: 'Wall mount wala 55 inch TV, 45000 tak, Sunday ko', lang: 'hi-IN', due: sunday, label: 'Sunday ko', phone: null, ago: 50 },
    { ...tv, text: '55 inch TV chahiye wall mount ke saath, budget 45000, Sunday', lang: 'hi-IN', due: sunday, label: 'Sunday', phone: '9000000207', ago: 30 },
    { ...buds, text: 'Noise cancelling earbuds 3000 ke andar', lang: 'hi-IN', due: addDaysISO(today, 2), label: 'parso', phone: '9000000208', ago: 85 },
    { ...buds, text: 'ANC earbuds under 3000', lang: 'en-IN', due: sunday, label: 'by Sunday', phone: null, ago: 55 },
    { ...buds, text: 'Noise cancelling earphones, 3000 tak', lang: 'hi-IN', due: null, label: null, phone: '9000000209', ago: 25 },
    { ...laptop, text: 'College ke liye laptop 16 GB RAM, 60000 ke andar, Monday tak', lang: 'hi-IN', due: monday, label: 'Monday tak', phone: '9000000210', ago: 65 },
    { ...laptop, text: 'Laptop for college, 16 GB RAM, under 60000, by Monday', lang: 'en-IN', due: monday, label: 'by Monday', phone: '9000000211', ago: 40 },
    { ...laptop, text: '16 GB RAM laptop 60000 tak, Monday se pehle', lang: 'hi-IN', due: monday, label: 'Monday se pehle', phone: null, ago: 15 },
    { text: '1.5 ton inverter AC aaj hi chahiye, garmi bahut hai', lang: 'hi-IN', item: '1.5 ton inverter AC', key: 'inverter_ac', hard: [], budget: null,
      due: today, label: 'aaj', urgent: true, phone: '9000000212', ago: 35, closed: 'cannot_meet_deadline' },
  ];
}

// The 55 inch TV at 42000 without a wall mount kit is in stock but must be rejected (like RC-02 in store 1).
const PRODUCTS = [
  { id: 'GD-PH-01', item_key: 'samsung_galaxy', name: 'Samsung Galaxy phone, 256 GB, blue', tags: ['256_gb', 'color:blue'], price: 74999, stock_available: 0 },
  { id: 'GD-TV-01', item_key: 'tv', name: '55 inch 4K TV with wall mount kit', tags: ['size:55_inch', 'wall_mount'], price: 44990, stock_available: 0 },
  { id: 'GD-TV-02', item_key: 'tv', name: '55 inch 4K TV (no wall mount kit)', tags: ['size:55_inch'], price: 42000, stock_available: 2 },
  { id: 'GD-EB-01', item_key: 'earbuds', name: 'Noise cancelling earbuds', tags: ['noise_cancelling'], price: 2799, stock_available: 0 },
  { id: 'GD-LP-01', item_key: 'laptop', name: 'Laptop, 16 GB RAM, 512 GB SSD', tags: ['16_gb_ram'], price: 58990, stock_available: 0 },
  { id: 'GD-AC-01', item_key: 'inverter_ac', name: '1.5 ton inverter AC', tags: [], price: 38990, stock_available: 0 },
];

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`store2 ${what}: ${res.error.message}`);
  return res.data;
}

export async function resetStore2(): Promise<ResetCounts> {
  const c = db();
  const shop = must(await c.from('shops').upsert({ slug: STORE2.slug, name: STORE2.name }, { onConflict: 'slug' }).select('id').single(), 'shop');
  const shopId = (shop as { id: string }).id;
  const old = (must(await c.from('requests').select('id').eq('shop_id', shopId), 'old') as { id: string }[]).map((r) => r.id);
  must(await c.from('events').delete().eq('shop_id', shopId), 'events');
  if (old.length) must(await c.from('reservations').delete().in('request_id', old), 'reservations');
  must(await c.from('requests').delete().eq('shop_id', shopId), 'requests');
  must(await c.from('products').delete().eq('shop_id', shopId), 'products');

  must(await c.from('products').insert(PRODUCTS.map((p) => ({ ...p, shop_id: shopId, synthetic: true }))), 'products insert');

  const today = todayIST();
  const now = Date.now();
  const rows = seeds(today).map((s, i) => {
    const urgent = s.urgent ?? false;
    const missing = [s.budget === null && 'max_budget', s.due === null && !urgent && 'needed_by'].filter(Boolean);
    const at = new Date(now - s.ago * 60_000).toISOString();
    return {
      id: `00000000-0000-4000-8000-${(201 + i).toString().padStart(12, '0')}`,
      shop_id: shopId,
      token: newToken(),
      source_text: s.text,
      input_mode: 'typed',
      extraction: { item: s.item, item_key: s.key, hard_constraints: s.hard, soft_preferences: [], max_budget: s.budget, quantity: null,
        needed_by: s.due, needed_by_label: s.label, urgent, language: s.lang, missing, clarifying_question: null, source_text: s.text, mode: 'rules_fallback' },
      extraction_mode: 'rules_fallback',
      item_label: s.item, item_key: s.key, hard_constraints: s.hard, max_budget: s.budget, quantity: null, needed_by: s.due, urgent,
      cluster_key: clusterKey({ urgent, item_key: s.key, hard_constraints: s.hard, max_budget: s.budget }),
      phone: s.phone, consent: s.phone !== null,
      status: s.closed ? 'closed' : 'open', close_reason: s.closed ?? null,
      synthetic: true, created_at: at, updated_at: at,
    };
  });
  must(await c.from('requests').insert(rows), 'requests insert');
  const events = rows.flatMap((r) => [
    { shop_id: shopId, request_id: r.id, type: 'captured', payload: { seed: true }, created_at: r.created_at },
    ...(r.status === 'closed' ? [{ shop_id: shopId, request_id: r.id, type: 'closed', payload: { reason: r.close_reason, from: 'open', seed: true }, created_at: r.created_at }] : []),
  ]);
  must(await c.from('events').insert(events), 'events insert');
  return { products: PRODUCTS.length, requests: rows.length, reservations: 0, events: events.length };
}
