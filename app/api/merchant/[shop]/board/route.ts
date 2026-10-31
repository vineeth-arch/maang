import { json } from '@/lib/http';
import { buildBoard } from '@/lib/server/board';
import { authShop } from '@/lib/server/merchant';
import { safe } from '@/lib/server/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ shop: string }> }) {
  return safe('board', async () => {
    const { shop: slug } = await params;
    const shop = await authShop(req, slug);
    if (shop instanceof Response) return shop;
    return json(await buildBoard(shop));
  });
}
