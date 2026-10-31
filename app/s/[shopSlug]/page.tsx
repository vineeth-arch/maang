import CaptureFlow from '@/components/customer/CaptureFlow';

const SHOP_NAMES: Record<string, string> = {
  'neighbourhood-toys': 'Neighbourhood Toys (demo)',
};

export default async function ShopCapturePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await params;
  return <CaptureFlow shopSlug={shopSlug} shopName={SHOP_NAMES[shopSlug] ?? shopSlug} />;
}
