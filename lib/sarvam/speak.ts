import { z } from 'zod';
import { VoiceLaneError, type VoiceLane } from '../contracts';
import { sarvamFetch } from './client';
const cache = new Map<string, ArrayBuffer>();
const schema = z.object({ audios: z.array(z.string().min(1)).min(1) });
export const speak: VoiceLane['speak'] = async (text, language) => {
  const key = JSON.stringify([text, language]);
  const cached = cache.get(key);
  if (cached) { cache.delete(key); cache.set(key, cached); return { audio: cached.slice(0), mime: 'audio/wav' }; }
  const speaker = process.env.SARVAM_TTS_SPEAKER?.trim();
  const parsed = schema.safeParse(await sarvamFetch('speak', '/text-to-speech', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, target_language_code: language, model: process.env.SARVAM_TTS_MODEL?.trim() || 'bulbul:v3', ...(speaker ? { speaker } : {}) }),
  }, 8000));
  if (!parsed.success) throw new VoiceLaneError('speak', 'parse', 'Invalid speech response');
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = Uint8Array.from(atob(parsed.data.audios[0]), c => c.charCodeAt(0)); }
  catch { throw new VoiceLaneError('speak', 'parse', 'Invalid base64 audio'); }
  if (String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.slice(8, 12)) !== 'WAVE') throw new VoiceLaneError('speak', 'parse', 'Expected WAV audio');
  cache.set(key, bytes.buffer);
  if (cache.size > 50) cache.delete(cache.keys().next().value!);
  return { audio: bytes.buffer.slice(0), mime: 'audio/wav' };
};
