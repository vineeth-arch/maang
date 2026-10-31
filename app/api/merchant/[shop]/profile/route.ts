import { z } from 'zod';
import { json, jsonError } from '@/lib/http';
import { authShop } from '@/lib/server/merchant';
import { profileFor, saveProfile } from '@/lib/server/insights';
import { readJson, safe } from '@/lib/server/route';
import { BANDS } from '@/lib/tier-bands';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  annual_revenue_band: z.enum(BANDS.map((b) => b.id) as [string, ...string[]]),
  locations: z.number().int().min(1).max(5000),
});

export async function POST(req: Request, { params }: { params: Promise<{ shop: string }> }) {
  return safe('profile', async () => {
    const { shop: slug } = await params;
    const shop = await authShop(req, slug);
    if (shop instanceof Response) return shop;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, 'bad_request');
    const p = profileFor(parsed.data.annual_revenue_band as (typeof BANDS)[number]['id'], parsed.data.locations);
    await saveProfile(shop, p);
    return json(p);
  });
}
