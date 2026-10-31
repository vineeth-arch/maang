export type RelativeDeadline = 'today' | 'tomorrow' | 'day_after' | 'this_week' | 'this_weekend' | 'specific_date' | 'none';
export type ExtractedRequest = {
  item: string | null;            // label in plain words, e.g. "rechargeable remote control car"
  item_key: string | null;        // canonical snake_case English noun, e.g. "rc_car"
  hard_constraints: string[];     // vocabulary: rechargeable, disposable_batteries, eggless, sugar_free, size:<v>, color:<v>, age:<v>, pieces:<n>, brand:<v>
  soft_preferences: string[];     // nice-to-haves, free text
  max_budget: number | null;      // INR, upper limit
  quantity: number | null;
  needed_by: string | null;       // ISO date YYYY-MM-DD, resolved in code in Asia/Kolkata, never by the model
  needed_by_label: string | null; // as spoken, e.g. "kal shaam"
  urgent: boolean;                // needs it within hours
  language: string;               // BCP-47, e.g. "hi-IN"
  missing: Array<'item' | 'max_budget' | 'needed_by'>;
  clarifying_question: string | null; // exactly one question, or null
  source_text: string;            // the exact input text
  mode: 'ai' | 'rules_fallback';
};
export type TranscribeResult = { text: string; language: string; ms: number };
export type VoiceStage = 'transcribe' | 'extract' | 'speak';
export class VoiceLaneError extends Error {
  constructor(public stage: VoiceStage, public kind: 'timeout' | 'http' | 'parse' | 'config' | 'unavailable', message: string) { super(message); this.name = 'VoiceLaneError'; }
}
export interface VoiceLane {
  transcribe(audio: ArrayBuffer, mime: string): Promise<TranscribeResult>;
  extract(text: string, todayISO: string, hints?: { item_keys: string[] }): Promise<ExtractedRequest>;
  speak(text: string, language: string): Promise<{ audio: ArrayBuffer; mime: string }>;
}
