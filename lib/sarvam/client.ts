import { VoiceLaneError, type VoiceStage } from '../contracts';

// Consume the body under the same deadline as the network request.
export async function sarvamFetch(stage: VoiceStage, path: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) throw new VoiceLaneError(stage, 'config', 'Sarvam API key is not configured');
  const controller = new AbortController();
  const started = performance.now();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  let status: number | string = 'network_error';
  try {
    const headers = new Headers(init.headers);
    headers.set('api-subscription-key', key);
    const response = await fetch(`https://api.sarvam.ai${path}`, { ...init, headers, signal: controller.signal });
    status = response.status;
    if (!response.ok) {
      // Only inspect the deprecated-model marker; never expose response bodies.
      const body = await response.text();
      const deprecated = /deprecated/i.test(body);
      throw new VoiceLaneError(stage, 'http', `Sarvam HTTP ${response.status}${deprecated ? '; deprecated model; consult provider model list' : ''}`);
    }
    try { return await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new VoiceLaneError(stage, 'parse', 'Invalid Sarvam JSON response');
    }
  } catch (error) {
    if (controller.signal.aborted) {
      status = 'timeout';
      throw new VoiceLaneError(stage, 'timeout', 'Sarvam request timed out');
    }
    if (error instanceof VoiceLaneError) throw error;
    throw new VoiceLaneError(stage, 'http', 'Sarvam network request failed');
  } finally {
    clearTimeout(timer);
    console.info(JSON.stringify({ stage, ms: Math.round(performance.now() - started), status }));
  }
}
