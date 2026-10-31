import StatusView from '@/components/customer/StatusView';

export default async function RequestStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const t = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  return <StatusView id={id} t={t ?? ''} />;
}
