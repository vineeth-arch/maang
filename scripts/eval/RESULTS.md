# Voice evaluation

Measured: 2026-10-31T07:27:28.678Z. Today fixed at 2026-10-31.

STT mode: transcribe. Models use configured environment or saaras:v3, sarvam-105b, bulbul:v3 defaults.

Synthetic audio is TTS round-trip audio, not real microphone evidence. Real clips have no labelled expectations and remain unscored. Deadline tokens are scored by their resolved ISO date because VoiceLane does not expose raw tokens.

## Per-field totals

| Field | AI text | Rules fallback | Audio AI |
|---|---:|---:|---:|
| item_key | 0/2 | 9/10 | 0/0 |
| hard_constraints | 0/2 | 7/7 | 0/0 |
| max_budget | 0/1 | 7/7 | 0/0 |
| deadline_token | 0/1 | 3/4 | 0/0 |
| missing | 0/1 | 2/2 | 0/0 |
| urgent | 0/1 | 1/1 | 0/0 |
| soft_preferences | 0/0 | 0/1 | 0/0 |
| forbidden_hard_prefix | 0/0 | 1/1 | 0/0 |
| item | 0/0 | 1/1 | 0/0 |

## Latency

| Mode / stage | n | p50 ms | max ms |
|---|---:|---:|---:|
| ai / extract | 4 | 7003 | 7005 |
| rules_fallback / extract | 14 | 0 | 1 |

## ai case 1

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | null | FAIL |
| hard_constraints | ["rechargeable"] | null | FAIL |
| max_budget | 1000 | null | FAIL |
| deadline_token | "tomorrow" | null | FAIL |

extract/timeout: Sarvam request timed out

## ai case 2

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | null | FAIL |
| missing | ["max_budget","needed_by"] | null | FAIL |

extract/timeout: Sarvam request timed out

## ai case 3

| Field | Expected | Got | Pass |
|---|---|---|---|
| hard_constraints | ["rechargeable"] | null | FAIL |

extract/timeout: Sarvam request timed out

## ai case 4

| Field | Expected | Got | Pass |
|---|---|---|---|
| urgent | true | null | FAIL |

extract/timeout: Sarvam request timed out

## rules_fallback case 1

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## rules_fallback case 2

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## rules_fallback case 3

| Field | Expected | Got | Pass |
|---|---|---|---|
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |

## rules_fallback case 4

| Field | Expected | Got | Pass |
|---|---|---|---|
| urgent | true | true | PASS |

## rules_fallback case 5

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |
| deadline_token | "this_weekend" | null | FAIL |

## rules_fallback case 6

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "jigsaw_puzzle" | "jigsaw_puzzle" | PASS |
| hard_constraints | ["pieces:1000"] | ["pieces:1000"] | PASS |
| max_budget | 800 | 800 | PASS |

## rules_fallback case 7

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |

## rules_fallback case 8

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cricket_bat" | "cricket_bat" | PASS |
| hard_constraints | ["size:5"] | ["size:5"] | PASS |
| deadline_token | "day_after" | "2026-11-02" | PASS |

## rules_fallback case 9

| Field | Expected | Got | Pass |
|---|---|---|---|
| max_budget | 2000 | 2000 | PASS |
| soft_preferences | "red" | [] | FAIL |
| forbidden_hard_prefix | "color:" | [] | PASS |

## rules_fallback case 10

| Field | Expected | Got | Pass |
|---|---|---|---|
| item | null | null | PASS |
| hard_constraints | [] | [] | PASS |

## rules_fallback case 11

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cake" | "cake" | PASS |
| hard_constraints | ["eggless"] | ["eggless"] | PASS |

## rules_fallback case 12

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## rules_fallback case 13

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | null | FAIL |
| max_budget | null | null | PASS |

## rules_fallback case 14

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["car","rc_car"] | "car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## Known failures

- ai 1: extract/timeout: Sarvam request timed out
- ai 2: extract/timeout: Sarvam request timed out
- ai 3: extract/timeout: Sarvam request timed out
- ai 4: extract/timeout: Sarvam request timed out
- rules_fallback 5: deadline_token
- rules_fallback 9: soft_preferences
- rules_fallback 13: item_key
- Synthetic clips do not establish noisy-shop microphone accuracy.
- Evaluation incomplete when recorded rows do not cover all 14 text cases and 6 synthetic audio cases. Network runs stop on repeated stage failures.
- Fields omitted from a case expectation are not scored. Rules fallback uses a fixed vocabulary and misses unsupported or misspelt items.
- Audio stages are measured separately; cached/generated audio skips are not counted as fresh TTS calls.

## Run status

Incomplete: AI cases 1 through 4 all timed out at 7 seconds. Stopped network evaluation under the repeated-failure condition. Audio mode was not run. AI case 10 remains untested. Rules mode ran all 14 cases. No real clips were present. Type generation and TypeScript passed; deterministic QA passed 5/5. API-root curl connectivity returned HTTP 404 in 48 ms; chat timeout cause is unknown.
