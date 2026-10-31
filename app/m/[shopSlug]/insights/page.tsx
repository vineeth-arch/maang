import { Insights } from '@/components/merchant/Insights';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { shopSlug } = await params;
  const raw = (await searchParams).k;
  return <Insights shop={shopSlug} k={typeof raw === 'string' ? raw : ''} />;
}
