import { json } from '@/lib/http';
import { authShop } from '@/lib/server/merchant';
import { insightsFor } from '@/lib/server/insights';
import { safe } from '@/lib/server/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ shop: string }> }) {
  return safe('insights', async () => {
    const { shop: slug } = await params;
    const shop = await authShop(req, slug);
    if (shop instanceof Response) return shop;
    return json(await insightsFor(shop));
  });
}
