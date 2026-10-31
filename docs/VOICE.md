# Sarvam voice lane

Exports `sarvamLane: VoiceLane` from `lib/sarvam/index.ts`. Main integrates later with:

```ts
export { sarvamLane as voice } from './sarvam';
```

This branch does not change the app adapter. Native fetch uses the subscription-key header. Timeout budgets include body reading: STT 12 seconds, extraction 15 seconds including repair, TTS 8 seconds. TTS has a 50-entry in-memory LRU cache. A cached result returns a copy.

Defaults for empty environment values are saaras:v3, sarvam-105b, and bulbul:v3. Speaker is omitted unless configured. Never print provider keys or HTTP bodies.

Run checks and evaluations from this worktree:

```sh
npx next typegen
npx tsc --noEmit
npx tsx --test scripts/eval/sarvam.test.ts
npx tsx scripts/eval/run.ts text
npx tsx scripts/eval/run.ts audio
npx tsx scripts/eval/run.ts rules
```

Audio mode converts synthetic and real clips to 16 kHz mono PCM WAV with macOS afconvert. Put real clips in scripts/eval/audio/real/. These clips have no labelled expectations, so results report successful processing without accuracy claims. Generated audio and local real clips are excluded from commits. RESULTS.md and measurements.json preserve measured results across modes.

## VOICE-DIAG outcome

Curl reproduced the old timeout outside native fetch: original requests returned HTTP 200 in 8.749495, 11.638642, and 7.757599 seconds. The same system with user message Say OK and max_tokens 50 returned HTTP 200 in 0.566423 seconds, ending at the token limit. Those four baseline results are in scripts/eval/diagnostics.json. Other diagnostics-*.json files record individual experiments.

Prompt compression and 1200/800-token caps truncated output. Explicit low reasoning still exceeded 15 seconds on some cases. JSON response mode with low reasoning also exhausted 2000 tokens on case 4. The documented string none value returned HTTP 400 and was removed. The documented nullable value, sent as JSON null, returned complete case-4 JSON in 0.893984 seconds. Keeping examples, adding JSON response mode, disabling reasoning with null, and retaining a 15-second total deadline fixed measured timeouts. An 800-token cap then passed response validation for all 14 fresh text cases. This result supports reasoning overhead as the cause, rather than a native-fetch timer bug.

Provider references: [V1 request schema](https://docs.sarvam.ai/api-reference/chat/chat-completions-v1), [model token-budget notes](https://docs.sarvam.ai/api/token-factory/models/sarvam-105b). V1 reference lists reasoning_effort as nullable and describes disabling it with None. Observed API behavior differs from its string enum listing; use explicit JSON null, not the string none.

Set SARVAM_EXTRACT_MODE=rules to skip chat entirely; output mode is rules_fallback, the existing contract's basic mode. Default is ai. No contract or app adapter changed. Tests confirm the switch makes zero network calls. This is an explicit operator switch, not an automatic conversion of failed AI calls into successful AI scores.

Fresh AI extraction p50 was 930 ms, max 1100 ms, with 14 calls. Cases 1, 4, and injection case 10 passed their scored fields. Cases 9 and 11 still have semantic errors; RESULTS.md lists every field and rules comparison. These measurements are not a production latency guarantee.

No real clips existed in either worktree. Real-clip STT remains unverified. The one synthetic TTS smoke returned WAV in 369 ms after explicitly unsetting a malformed local speaker value. Synthetic STT returned in 249 ms with transcript नाही मांग आहे. and language mr-IN for the intended Hindi input Nayi maang aayi. This is a language/transcript mismatch, not real microphone evidence.

The local SARVAM_TTS_SPEAKER value incorrectly contains NEXT_PUBLIC_SOUNDBOX=0. Environment files are outside this lane and were not edited. Main must set SARVAM_TTS_SPEAKER to an empty value or a documented valid speaker, and keep NEXT_PUBLIC_SOUNDBOX on its own line. The test command used an explicit empty override:

```sh
SARVAM_TTS_SPEAKER='' npx tsx scripts/eval/speech-smoke.ts
```

Diagnosis and smoke scripts never print keys or response bodies. Raw audio is ignored by Git. Real clips can be added later and processed with speech-smoke.ts; it copies supported audio from main's real-clip folder and normalizes with afconvert.
