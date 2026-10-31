import { requireMerchant } from '@/lib/http';
import { getShop, type Shop } from './repo';
import { notFound } from './route';

// Returns the shop, or a ready 401/404 Response.
export async function authShop(req: Request, slug: string): Promise<Shop | Response> {
  const denied = requireMerchant(req);
  if (denied) return denied;
  const shop = await getShop(slug);
  if (!shop) return notFound();
  return shop;
}
