import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { voice } from '@/lib/voice';
import { authShop } from '@/lib/server/merchant';
import { rateLimited } from '@/lib/server/ratelimit';
import { getRequestById } from '@/lib/server/repo';
import { readJson, notFound, safe, isUuid } from '@/lib/server/route';
import { soundboxOn, newRequestText, notifiedText } from '@/lib/soundbox';
import type { SpeakBody } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const speakSchema: z.ZodType<SpeakBody> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('new'), request_id: z.string().refine(isUuid) }),
  z.object({ kind: z.literal('notified'), count: z.number().int().min(0).max(999) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ shop: string }> }) {
  return safe('speak', async () => {
    if (!soundboxOn) return notFound();
    const { shop: slug } = await params;
    const shop = await authShop(req, slug);
    if (shop instanceof Response) return shop;
    if (rateLimited(`speak:${shop.id}`, 1, 3000)) return jsonError(429, 'rate_limited');

    const parsed = speakSchema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, 'bad_request');
    const body = parsed.data;

    let text: string;
    if (body.kind === 'new') {
      const row = await getRequestById(body.request_id);
      if (!row || row.shop_id !== shop.id) return notFound();
      text = newRequestText(row.item_label, row.max_budget);
    } else {
      text = notifiedText(body.count);
    }

    try {
      const out = await voice.speak(text, 'hi-IN');
      return new Response(out.audio, { headers: { 'content-type': out.mime, 'cache-control': 'no-store' } });
    } catch (e) {
      console.error('[api] speak voice failed:', e instanceof Error ? e.name : 'unknown');
      return jsonError(503, 'voice_unavailable');
    }
  });
}
