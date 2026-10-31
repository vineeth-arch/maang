import { db } from '@/lib/db';
import { safeEqual } from '@/lib/http';
import type { Product, RequestRow } from '@/lib/api-types';

export type Shop = { id: string; slug: string; name: string };

export async function getShop(slug: string): Promise<Shop | null> {
  const { data, error } = await db().from('shops').select('id, slug, name').eq('slug', slug).maybeSingle();
  if (error) throw new Error(`shop lookup: ${error.message}`);
  return (data as Shop | null) ?? null;
}

export async function getShopById(id: string): Promise<Shop | null> {
  const { data, error } = await db().from('shops').select('id, slug, name').eq('id', id).maybeSingle();
  if (error) throw new Error(`shop lookup: ${error.message}`);
  return (data as Shop | null) ?? null;
}

export async function getProducts(shopId: string): Promise<Product[]> {
  const { data, error } = await db().from('products').select('*').eq('shop_id', shopId).order('id', { ascending: true });
  if (error) throw new Error(`products: ${error.message}`);
  return (data ?? []) as Product[];
}

export async function getProduct(shopId: string, productId: string): Promise<Product | null> {
  const { data, error } = await db()
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(`product: ${error.message}`);
  return (data as Product | null) ?? null;
}

export async function getRequestById(id: string): Promise<RequestRow | null> {
  const { data, error } = await db().from('requests').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`request: ${error.message}`);
  return (data as RequestRow | null) ?? null;
}

// Customer auth: unknown id, bad token or malformed input all yield null (caller returns an identical 404).
export async function getRequestWithToken(id: string, token: string | null): Promise<RequestRow | null> {
  if (!token) return null;
  const row = await getRequestById(id);
  if (!row || !safeEqual(token, row.token)) return null;
  return row;
}

export async function getShopRequests(shopId: string): Promise<RequestRow[]> {
  const { data, error } = await db()
    .from('requests')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) throw new Error(`requests: ${error.message}`);
  return (data ?? []) as RequestRow[];
}

export async function getProductById(productId: string): Promise<Product | null> {
  const { data, error } = await db().from('products').select('*').eq('id', productId).maybeSingle();
  if (error) throw new Error(`product: ${error.message}`);
  return (data as Product | null) ?? null;
}

export async function rpcText(name: string, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await db().rpc(name, args);
  if (error) throw new Error(`rpc ${name}: ${error.message}`);
  return String(data);
}
