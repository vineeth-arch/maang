import QRCode from 'qrcode';
import { baseUrl } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await ctx.params;
  const url = `${baseUrl(req)}/s/${shopSlug}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return new Response(svg, {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' },
  });
}
