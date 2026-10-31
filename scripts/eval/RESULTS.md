# Voice evaluation

Measured: 2026-10-31T07:44:46.677Z. Today fixed at 2026-10-31.

STT mode: transcribe. Models use configured environment or saaras:v3, sarvam-105b, bulbul:v3 defaults.

Synthetic audio is TTS round-trip audio, not real microphone evidence. Real clips have no labelled expectations and remain unscored. Deadline tokens are scored by their resolved ISO date because VoiceLane does not expose raw tokens.

## Per-field totals

| Field | AI text | Rules fallback | Audio AI |
|---|---:|---:|---:|
| item_key | 9/10 | 9/10 | 0/0 |
| hard_constraints | 6/7 | 7/7 | 0/0 |
| max_budget | 7/7 | 7/7 | 0/0 |
| deadline_token | 4/4 | 3/4 | 0/0 |
| missing | 2/2 | 2/2 | 0/0 |
| urgent | 1/1 | 1/1 | 0/0 |
| soft_preferences | 0/1 | 0/1 | 0/0 |
| forbidden_hard_prefix | 0/1 | 1/1 | 0/0 |
| item | 1/1 | 1/1 | 0/0 |

## Latency

| Mode / stage | n | p50 ms | max ms |
|---|---:|---:|---:|
| ai / extract | 14 | 930 | 1100 |
| rules_fallback / extract | 14 | 0 | 3 |

## ai case 1

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## rules_fallback case 1

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## ai case 2

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## rules_fallback case 2

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## ai case 3

| Field | Expected | Got | Pass |
|---|---|---|---|
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |

## rules_fallback case 3

| Field | Expected | Got | Pass |
|---|---|---|---|
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |

## ai case 4

| Field | Expected | Got | Pass |
|---|---|---|---|
| urgent | true | true | PASS |

## rules_fallback case 4

| Field | Expected | Got | Pass |
|---|---|---|---|
| urgent | true | true | PASS |

## ai case 5

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |
| deadline_token | "this_weekend" | "2026-11-01" | PASS |

## rules_fallback case 5

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |
| deadline_token | "this_weekend" | null | FAIL |

## ai case 6

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "jigsaw_puzzle" | "jigsaw_puzzle" | PASS |
| hard_constraints | ["pieces:1000"] | ["pieces:1000"] | PASS |
| max_budget | 800 | 800 | PASS |

## rules_fallback case 6

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "jigsaw_puzzle" | "jigsaw_puzzle" | PASS |
| hard_constraints | ["pieces:1000"] | ["pieces:1000"] | PASS |
| max_budget | 800 | 800 | PASS |

## ai case 7

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |

## rules_fallback case 7

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |

## ai case 8

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cricket_bat" | "cricket_bat" | PASS |
| hard_constraints | ["size:5"] | ["size:5"] | PASS |
| deadline_token | "day_after" | "2026-11-02" | PASS |

## rules_fallback case 8

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cricket_bat" | "cricket_bat" | PASS |
| hard_constraints | ["size:5"] | ["size:5"] | PASS |
| deadline_token | "day_after" | "2026-11-02" | PASS |

## ai case 9

| Field | Expected | Got | Pass |
|---|---|---|---|
| max_budget | 2000 | 2000 | PASS |
| soft_preferences | "red" | [] | FAIL |
| forbidden_hard_prefix | "color:" | ["color:laal"] | FAIL |

## rules_fallback case 9

| Field | Expected | Got | Pass |
|---|---|---|---|
| max_budget | 2000 | 2000 | PASS |
| soft_preferences | "red" | [] | FAIL |
| forbidden_hard_prefix | "color:" | [] | PASS |

## ai case 10

| Field | Expected | Got | Pass |
|---|---|---|---|
| item | null | null | PASS |
| hard_constraints | [] | [] | PASS |

## rules_fallback case 10

| Field | Expected | Got | Pass |
|---|---|---|---|
| item | null | null | PASS |
| hard_constraints | [] | [] | PASS |

## ai case 11

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cake" | null | FAIL |
| hard_constraints | ["eggless"] | [] | FAIL |

## rules_fallback case 11

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cake" | "cake" | PASS |
| hard_constraints | ["eggless"] | ["eggless"] | PASS |

## ai case 12

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## rules_fallback case 12

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## ai case 13

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| max_budget | null | null | PASS |

## rules_fallback case 13

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | null | FAIL |
| max_budget | null | null | PASS |

## ai case 14

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["car","rc_car"] | "car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## rules_fallback case 14

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["car","rc_car"] | "car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## Known failures

- rules_fallback 5: deadline_token
- ai 9: soft_preferences, forbidden_hard_prefix
- rules_fallback 9: soft_preferences
- ai 11: item_key, hard_constraints
- rules_fallback 13: item_key
- Synthetic clips do not establish noisy-shop microphone accuracy.
- Evaluation incomplete when recorded rows do not cover all 14 text cases and 6 synthetic audio cases. Network runs stop on repeated stage failures.
- Fields omitted from a case expectation are not scored. Rules fallback uses a fixed vocabulary and misses unsupported or misspelt items.
- Audio stages are measured separately; cached/generated audio skips are not counted as fresh TTS calls.

## VOICE-DIAG measurements

| Curl request | HTTP status | Seconds | Outcome |
|---|---:|---:|---|
| Exact original extraction 1 | 200 | 8.749495 | Complete validated JSON |
| Exact original extraction 2 | 200 | 11.638642 | Complete validated JSON |
| Exact original extraction 3 | 200 | 7.757599 | Complete validated JSON |
| Same system, user Say OK, max_tokens 50 | 200 | 0.566423 | Token limit, incomplete JSON |

Cause: curl reproduced latency beyond 7 seconds. Compression and smaller caps did not fix it. Low reasoning still produced timeouts/truncation. Documented JSON-null reasoning_effort disabled reasoning; final native-fetch eval completed all 14 requests without timeouts. Final settings: max_tokens 800, JSON response mode, 15-second extraction budget including repair. See docs/VOICE.md and diagnostics-*.json for each experiment.

SARVAM_EXTRACT_MODE exists: ai by default; rules skips chat and returns rules_fallback. QA verifies zero network calls in rules mode.

| Speech check | Count | p50 / latency | Transcript or outcome |
|---|---:|---:|---|
| Real clips, both worktrees | 0 | Not measured | No real clips found; real STT not tested |
| Synthetic TTS | 1 successful call | 369 ms | WAV decoded successfully |
| Synthetic STT | 1 | 249 ms | नाही मांग आहे. (mr-IN) |

Synthetic STT misrecognized intended Hindi input Nayi maang aayi as Marathi. This is a known mismatch. TTS first returned HTTP 400 in 105 ms because the local speaker variable contains another environment assignment; explicit empty speaker override succeeded. Environment file remains unchanged.

AI cases 1 and 4 pass all expected fields; case 10 returns null item without exception. Full text suite and rules comparison ran; six-case synthetic audio eval was not rerun in this diagnostic task. No real-clip transcription success is claimed.
