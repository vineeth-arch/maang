import { Board } from '@/components/merchant/Board';

export const dynamic = 'force-dynamic';

export default async function MerchantBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { shopSlug } = await params;
  const sp = await searchParams;
  const raw = sp.k;
  const k = typeof raw === 'string' ? raw : '';
  return <Board shop={shopSlug} k={k} />;
}
