# Sarvam voice lane

Exports `sarvamLane: VoiceLane` from `lib/sarvam/index.ts`. Main integrates later with:

```ts
export { sarvamLane as voice } from './sarvam';
```

This branch does not change the app adapter. Native fetch uses the subscription-key header. Timeout budgets include body reading: STT 12 seconds, extraction 7 seconds including repair, TTS 8 seconds. TTS has a 50-entry in-memory LRU cache. A cached result returns a copy.

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

Current status: incomplete. Four live extraction calls exceeded the fixed 7-second budget. Evaluation stopped before audio mode. Rules evaluation ran all 14 cases. No real clips were present. API root responded to an unauthenticated curl connectivity check in 48 ms; that does not establish chat endpoint health or explain the native-fetch timeouts. No live STT, TTS, or injection-case success is claimed. See RESULTS.md for per-field counts and failures.
