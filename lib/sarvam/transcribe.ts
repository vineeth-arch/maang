import { z } from 'zod';
import { VoiceLaneError, type VoiceLane } from '../contracts';
import { sarvamFetch } from './client';
const schema = z.object({ transcript: z.string(), language_code: z.string().nullish() });
export const transcribe: VoiceLane['transcribe'] = async (audio, mime) => {
  if (!/wav/i.test(mime)) throw new VoiceLaneError('transcribe', 'parse', 'Audio must be WAV');
  const started = performance.now();
  const form = new FormData();
  form.set('file', new Blob([audio], { type: 'audio/wav' }), 'recording.wav');
  form.set('model', process.env.SARVAM_STT_MODEL?.trim() || 'saaras:v3');
  form.set('mode', 'transcribe');
  const parsed = schema.safeParse(await sarvamFetch('transcribe', '/speech-to-text', { method: 'POST', body: form }, 12000));
  if (!parsed.success) throw new VoiceLaneError('transcribe', 'parse', 'Invalid transcript response');
  const text = parsed.data.transcript.trim();
  if (!text) throw new VoiceLaneError('transcribe', 'parse', 'empty transcript');
  return { text, language: parsed.data.language_code || 'hi-IN', ms: Math.round(performance.now() - started) };
};
