import { json, jsonError } from '@/lib/http';
import { voice } from '@/lib/voice';
import { extractRules } from '@/lib/voice-fallback';
import { todayIST, alignToCatalog } from '@/lib/domain';
import { getShop, getProducts } from '@/lib/server/repo';
import { extractBodySchema } from '@/lib/server/schemas';
import { readJson, safe, notFound } from '@/lib/server/route';
import type { ExtractedRequest } from '@/lib/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  return safe('extract', async () => {
    const parsed = extractBodySchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, 'bad_request');
    const { shopSlug, text, mode } = parsed.data;
    const today = todayIST();
    // Extraction must never fail the customer: if the DB is unreachable, extract without catalogue hints.
    let hints: { item_keys: string[] } | undefined;
    let products: Awaited<ReturnType<typeof getProducts>> = [];
    try {
      const shop = await getShop(shopSlug);
      if (!shop) return notFound();
      products = await getProducts(shop.id);
      hints = { item_keys: [...new Set(products.map((p) => p.item_key))] };
    } catch (e) {
      console.error('[api] extract: catalogue lookup failed, continuing without hints:', (e as Error).message);
    }

    if (mode === 'rules') return json(alignToCatalog(extractRules(text, today, hints), products));

    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), 7000);
      });
      try {
        const out: ExtractedRequest = await Promise.race([voice.extract(text, today, hints), timeout]);
        return json(alignToCatalog(out, products));
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch {
      const fallback: ExtractedRequest = { ...extractRules(text, today, hints), mode: 'rules_fallback' };
      return json(alignToCatalog(fallback, products));
    }
  });
}
