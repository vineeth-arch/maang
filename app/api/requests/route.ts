import { db } from '@/lib/db';
import { json, jsonError, newToken, clientIp } from '@/lib/http';
import { todayIST, resolveRelative, isValidFutureISO, clusterKey } from '@/lib/domain';
import { getShop } from '@/lib/server/repo';
import { createRequestSchema } from '@/lib/server/schemas';
import { rateLimited } from '@/lib/server/ratelimit';
import { readJson, safe, notFound } from '@/lib/server/route';
import type { CreateRequestResponse } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function cleanBudget(v: number | null | undefined): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0 || v > 1_000_000) return null;
  return v;
}

function normalisePhone(raw: string): string | null {
  let p = raw.replace(/[\s-]/g, '');
  if (p.startsWith('+91')) p = p.slice(3);
  else if (p.length === 12 && p.startsWith('91')) p = p.slice(2);
  return /^[6-9]\d{9}$/.test(p) ? p : null;
}

export async function POST(req: Request) {
  return safe('create_request', async () => {
    if (rateLimited(clientIp(req))) return jsonError(429, 'rate_limited');
    const parsed = createRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, 'bad_request');
    const body = parsed.data;

    const sourceText = body.source_text.trim().slice(0, 1000);
    if (!sourceText) return jsonError(400, 'bad_request');

    let phone: string | null = null;
    if (body.phone !== undefined && body.phone.trim() !== '') {
      phone = normalisePhone(body.phone);
      if (!phone) return jsonError(400, 'bad_request');
    }
    if (!body.consent) phone = null;

    const shop = await getShop(body.shopSlug);
    if (!shop) return notFound();

    const today = todayIST();
    const ex = body.extracted;

    const maxBudget = cleanBudget(
      body.answers && body.answers.max_budget !== undefined ? body.answers.max_budget : ex.max_budget,
    );

    let neededBy: string | null;
    if (body.answers?.needed_by) neededBy = resolveRelative(body.answers.needed_by, today);
    else neededBy = ex.needed_by && isValidFutureISO(ex.needed_by, today) ? ex.needed_by : null;
    if (ex.urgent && !neededBy) neededBy = today;

    const hard = [...new Set(ex.hard_constraints.map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 40))]
      .sort()
      .slice(0, 10);

    const itemKey = ex.item_key && /^[a-z0-9_]{1,40}$/.test(ex.item_key) ? ex.item_key : null;
    const itemLabel = ex.item ? ex.item.trim().slice(0, 120) || null : null;
    const key = clusterKey({ urgent: ex.urgent, item_key: itemKey, hard_constraints: hard, max_budget: maxBudget });

    const extraction = { ...ex, source_text: sourceText };
    const token = newToken();

    const { data, error } = await db()
      .from('requests')
      .insert({
        shop_id: shop.id,
        token,
        source_text: sourceText,
        input_mode: body.input_mode,
        extraction,
        extraction_mode: ex.mode,
        item_label: itemLabel,
        item_key: itemKey,
        hard_constraints: hard,
        max_budget: maxBudget,
        quantity: ex.quantity,
        needed_by: neededBy,
        urgent: ex.urgent,
        cluster_key: key,
        phone,
        consent: body.consent,
        synthetic: false,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`insert request: ${error?.message ?? 'no row'}`);
    const id = (data as { id: string }).id;

    const ev = await db().from('events').insert({ shop_id: shop.id, request_id: id, type: 'captured', payload: {} });
    if (ev.error) console.error('[api] captured event failed:', ev.error.message.slice(0, 200));

    const out: CreateRequestResponse = { id, token };
    return json(out, 201);
  });
}
