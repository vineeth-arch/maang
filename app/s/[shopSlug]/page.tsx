import CaptureFlow from '@/components/customer/CaptureFlow';

const SHOPS: Record<string, { name: string; subtitle?: string; example?: string }> = {
  'neighbourhood-toys': { name: 'Neighbourhood Toys (demo)' },
  'electronics-andheri': {
    name: 'Galaxy Digital, Andheri',
    subtitle: 'Electronics chain store, branch 1 of many (demo)',
    example: 'Samsung Galaxy 256 GB blue, kal tak',
  },
};

export default async function ShopCapturePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await params;
  const shop = SHOPS[shopSlug];
  return (
    <CaptureFlow
      shopSlug={shopSlug}
      shopName={shop?.name ?? shopSlug}
      subtitle={shop?.subtitle}
      example={shop?.example}
    />
  );
}
