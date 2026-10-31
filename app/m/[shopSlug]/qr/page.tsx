import { headers } from 'next/headers';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export default async function PrintableQrPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await params;
  const h = await headers();
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL;
  let base: string;
  if (fromEnv) {
    base = fromEnv.replace(/\/$/, '');
  } else {
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    base = `${proto}://${host}`;
  }
  const url = `${base}/s/${shopSlug}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  const name = shopSlug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center bg-[#EEEAE0] px-6 py-10 text-center text-[#17130F]">
      <style>{`@page { margin: 12mm; } @media print { body { background: #fff !important; } main { min-height: auto !important; } }`}</style>
      <p className="label-mono text-[#6B665C]">{name}</p>
      <h1 className="font-display mt-3 text-5xl font-bold leading-tight sm:text-7xl">Nahi mila? Scan karke bolo.</h1>
      <div
        className="mt-8 w-full max-w-md rounded-lg border border-[#17130F]/20 bg-white p-4 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="label-mono mt-6 break-all text-base text-[#17130F]">{url}</p>
    </main>
  );
}
