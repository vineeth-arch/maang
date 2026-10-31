import { json, jsonError } from '@/lib/http';
import { voice } from '@/lib/voice';
import { safe } from '@/lib/server/route';
import type { TranscribeResponse } from '@/lib/api-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  return safe('transcribe', async () => {
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES + 64 * 1024) return jsonError(413, 'payload_too_large');
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, 'bad_request');
    }
    const file = form.get('audio');
    if (!(file instanceof File)) return jsonError(400, 'bad_request');
    if (file.size > MAX_BYTES) return jsonError(413, 'payload_too_large');
    if (file.size === 0 || !file.type.startsWith('audio/')) return jsonError(400, 'bad_request');
    try {
      const out = await voice.transcribe(await file.arrayBuffer(), file.type);
      const body: TranscribeResponse = { text: out.text, language: out.language };
      return json(body);
    } catch (e) {
      console.error('[api] transcribe voice failed:', e instanceof Error ? e.name : 'unknown');
      return jsonError(503, 'voice_unavailable');
    }
  });
}
