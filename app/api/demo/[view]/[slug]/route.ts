import { demoRead } from '@/lib/server/demo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ view: string; slug: string }> }) {
  const { view, slug } = await params;
  return demoRead(req, slug, view);
}
