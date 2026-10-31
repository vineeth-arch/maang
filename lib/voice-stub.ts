import { VoiceLaneError, type ExtractedRequest, type TranscribeResult, type VoiceLane } from './contracts';
import { extractRules } from './voice-fallback';

// Stub lane: no network. Transcribe and speak are unavailable until the voice branch merges.
export const stubLane: VoiceLane = {
  async transcribe(): Promise<TranscribeResult> {
    throw new VoiceLaneError('transcribe', 'unavailable', 'Voice transcription is not connected yet');
  },
  async extract(text: string, todayISO: string, hints?: { item_keys: string[] }): Promise<ExtractedRequest> {
    return extractRules(text, todayISO, hints);
  },
  async speak(): Promise<{ audio: ArrayBuffer; mime: string }> {
    throw new VoiceLaneError('speak', 'unavailable', 'Voice output is not connected yet');
  },
};
