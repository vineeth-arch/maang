# Voice evaluation

Measured: 2026-10-31T11:19:17.331Z. Today fixed at 2026-10-31.

STT mode: transcribe. Models use configured environment or saaras:v3, sarvam-105b, bulbul:v3 defaults.

Synthetic audio is TTS round-trip audio, not real microphone evidence. Real clips have no labelled expectations and remain unscored. Deadline tokens are scored by their resolved ISO date because VoiceLane does not expose raw tokens.

## Per-field totals

| Field | AI text | Rules fallback | Audio AI |
|---|---:|---:|---:|
| item_key | 10/10 | 6/10 | 0/0 |
| hard_constraints | 7/7 | 5/7 | 0/0 |
| max_budget | 7/7 | 6/7 | 0/0 |
| deadline_token | 4/4 | 3/4 | 0/0 |
| missing | 2/2 | 1/2 | 0/0 |
| urgent | 1/1 | 1/1 | 0/0 |
| soft_preferences_contains | 0/1 | 0/1 | 0/0 |
| forbidden_hard_prefix | 0/1 | 1/1 | 0/0 |
| item | 1/1 | 1/1 | 0/0 |

AI requested but fell back: 0

AI requested but fell back (audio): 0

## Latency

| Mode / stage | n | p50 ms | max ms |
|---|---:|---:|---:|
| ai / extract | 14 | 712 | 1502 |
| rules / extract | 14 | 0 | 6 |

## ai case 1 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## rules case 1 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | null | FAIL |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## ai case 2 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## rules case 2 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## ai case 3 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |

## rules case 3 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |

## ai case 4 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| urgent | true | true | PASS |

## rules case 4 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| urgent | true | true | PASS |

## ai case 5 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |
| deadline_token | "this_weekend" | "2026-11-01" | PASS |

## rules case 5 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | null | FAIL |
| deadline_token | "this_weekend" | null | FAIL |

## ai case 6 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "jigsaw_puzzle" | "jigsaw_puzzle" | PASS |
| hard_constraints | ["pieces:1000"] | ["pieces:1000"] | PASS |
| max_budget | 800 | 800 | PASS |

## rules case 6 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "jigsaw_puzzle" | "jigsaw_puzzle" | PASS |
| hard_constraints | ["pieces:1000"] | ["pieces:1000"] | PASS |
| max_budget | 800 | 800 | PASS |

## ai case 7 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |

## rules case 7 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "gift_hamper" | "gift_hamper" | PASS |
| max_budget | 500 | 500 | PASS |

## ai case 8 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cricket_bat" | "cricket_bat" | PASS |
| hard_constraints | ["size:5"] | ["size:5"] | PASS |
| deadline_token | "day_after" | "2026-11-02" | PASS |

## rules case 8 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cricket_bat" | "cricket_bat" | PASS |
| hard_constraints | ["size:5"] | [] | FAIL |
| deadline_token | "day_after" | "2026-11-02" | PASS |

## ai case 9 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| max_budget | 2000 | 2000 | PASS |
| soft_preferences_contains | "red" | ["size:small"] | FAIL |
| forbidden_hard_prefix | "color:" | ["color:red"] | FAIL |

## rules case 9 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| max_budget | 2000 | 2000 | PASS |
| soft_preferences_contains | "red" | [] | FAIL |
| forbidden_hard_prefix | "color:" | [] | PASS |

## ai case 10 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item | null | null | PASS |
| hard_constraints | [] | [] | PASS |

## rules case 10 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item | null | null | PASS |
| hard_constraints | [] | [] | PASS |

## ai case 11 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cake" | "cake" | PASS |
| hard_constraints | ["eggless"] | ["eggless"] | PASS |

## rules case 11 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "cake" | null | FAIL |
| hard_constraints | ["eggless"] | [] | FAIL |

## ai case 12 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## rules case 12 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| hard_constraints | ["rechargeable"] | ["rechargeable"] | PASS |
| max_budget | 1000 | 1000 | PASS |
| deadline_token | "tomorrow" | "2026-11-01" | PASS |

## ai case 13 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | "rc_car" | PASS |
| max_budget | null | null | PASS |

## rules case 13 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "rc_car" | null | FAIL |
| max_budget | null | null | PASS |

## ai case 14 (actual: ai)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["car","rc_car"] | "car" | PASS |
| missing | ["max_budget","needed_by"] | ["max_budget","needed_by"] | PASS |

## rules case 14 (actual: rules_fallback)

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["car","rc_car"] | null | FAIL |
| missing | ["max_budget","needed_by"] | ["item","max_budget","needed_by"] | FAIL |

## Known failures

- rules 1: item_key
- rules 5: max_budget, deadline_token
- rules 8: hard_constraints
- ai 9: soft_preferences_contains, forbidden_hard_prefix
- rules 9: soft_preferences_contains
- rules 11: item_key, hard_constraints
- rules 13: item_key
- rules 14: item_key, missing
- Synthetic clips do not establish noisy-shop microphone accuracy.
- Evaluation incomplete when recorded rows do not cover all 14 text cases and 6 synthetic audio cases. Network runs stop on repeated stage failures.
- Fields omitted from a case expectation are not scored. Rules fallback uses a fixed vocabulary and misses unsupported or misspelt items.
- Audio stages are measured separately; cached/generated audio skips are not counted as fresh TTS calls.

## Beyond kirana

First run only; todayISO=2026-10-31 (Saturday). No catalog hints supplied, so toy-only hints cannot bias cross-vertical matching. Saturday means today and Sunday means tomorrow for these expectations. These are extraction checks, not proof of booking, catalog or cross-store integrations.

Expected fields were fixed before calls. Stylist gender is scored as a soft preference because the current hard-constraint vocabulary cannot encode it; that is a schema gap, not a valid booking constraint policy. Composite services, exact time, branch routing, 256 GB storage, wall mounting and next-week intervals are not fully scored because the contract lacks those fields. Medicine brand recognition is not medical advice.

| Case | Mode | Fields passed | Case pass | ms |
|---|---|---:|---|---:|
| xv-salon | rules (actual rules_fallback) | 1/4 | FAIL | 1 |
| xv-salon | ai (actual ai) | 2/4 | FAIL | 890 |
| xv-facial | rules (actual rules_fallback) | 1/2 | FAIL | 0 |
| xv-facial | ai (actual ai) | 1/2 | FAIL | 747 |
| xv-salon-chain | rules (actual rules_fallback) | 0/2 | FAIL | 0 |
| xv-salon-chain | ai (actual ai) | 0/2 | FAIL | 1241 |
| xv-electronics-phone | rules (actual rules_fallback) | 1/3 | FAIL | 0 |
| xv-electronics-phone | ai (actual ai) | 1/3 | FAIL | 866 |
| xv-electronics-tv | rules (actual rules_fallback) | 1/3 | FAIL | 0 |
| xv-electronics-tv | ai (actual ai) | 3/3 | PASS | 829 |
| xv-pharmacy | rules (actual rules_fallback) | 2/3 | FAIL | 0 |
| xv-pharmacy | ai (actual ai) | 2/3 | FAIL | 613 |
| xv-apparel | rules (actual rules_fallback) | 0/2 | FAIL | 0 |
| xv-apparel | ai (actual ai) | 2/2 | PASS | 732 |

| Field | Rules | AI |
|---|---:|---:|
| item_key | 0/7 | 3/7 |
| max_budget | 3/3 | 3/3 |
| needed_by | 3/6 | 4/6 |
| soft_preferences_contains | 0/1 | 0/1 |
| hard_constraints_subset | 0/1 | 0/1 |
| hard_constraints | 0/1 | 1/1 |

### xv-salon: rules

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["haircut","haircut_beard_trim"] | null | FAIL |
| max_budget | 600 | 600 | PASS |
| needed_by | "2026-10-31" | null | FAIL |
| soft_preferences_contains | "female" | [] | FAIL |

### xv-salon: ai

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["haircut","haircut_beard_trim"] | "haircut_beard_trim" | PASS |
| max_budget | 600 | 600 | PASS |
| needed_by | "2026-10-31" | "2026-11-01" | FAIL |
| soft_preferences_contains | "female" | ["haircut","beard trim"] | FAIL |

### xv-facial: rules

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "facial" | null | FAIL |
| needed_by | "2026-11-01" | "2026-11-01" | PASS |

### xv-facial: ai

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "facial" | null | FAIL |
| needed_by | "2026-11-01" | "2026-11-01" | PASS |

### xv-salon-chain: rules

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "hair_spa" | null | FAIL |
| needed_by | "2026-10-31" | null | FAIL |

### xv-salon-chain: ai

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "hair_spa" | null | FAIL |
| needed_by | "2026-10-31" | null | FAIL |

### xv-electronics-phone: rules

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["phone","smartphone","mobile_phone"] | null | FAIL |
| hard_constraints_subset | ["brand:samsung","color:blue"] | [] | FAIL |
| needed_by | "2026-11-01" | "2026-11-01" | PASS |

### xv-electronics-phone: ai

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["phone","smartphone","mobile_phone"] | "samsung_galaxy_phone" | FAIL |
| hard_constraints_subset | ["brand:samsung","color:blue"] | ["color:blue","size:256 gb"] | FAIL |
| needed_by | "2026-11-01" | "2026-11-01" | PASS |

### xv-electronics-tv: rules

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["tv","television"] | null | FAIL |
| max_budget | 45000 | 45000 | PASS |
| needed_by | "2026-11-01" | null | FAIL |

### xv-electronics-tv: ai

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["tv","television"] | "tv" | PASS |
| max_budget | 45000 | 45000 | PASS |
| needed_by | "2026-11-01" | "2026-11-01" | PASS |

### xv-pharmacy: rules

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["dolo","dolo_650","paracetamol"] | null | FAIL |
| max_budget | null | null | PASS |
| needed_by | "2026-10-31" | "2026-10-31" | PASS |

### xv-pharmacy: ai

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | ["dolo","dolo_650","paracetamol"] | null | FAIL |
| max_budget | null | null | PASS |
| needed_by | "2026-10-31" | "2026-10-31" | PASS |

### xv-apparel: rules

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "kurta" | null | FAIL |
| hard_constraints | ["size:xl","color:maroon"] | [] | FAIL |

### xv-apparel: ai

| Field | Expected | Got | Pass |
|---|---|---|---|
| item_key | "kurta" | "kurta" | PASS |
| hard_constraints | ["size:xl","color:maroon"] | ["color:maroon","size:xl"] | PASS |

### Open rule and schema gaps

- Fixed item vocabulary misses service names, medicine brands, apparel and electronics variants.
- Saturday, service appointment times and next-week intervals need explicit deadline semantics.
- Multi-service requests, stylist requirements, alternative branches, storage capacity and installation need future structured fields and catalog confirmation.
- Rules and AI failures above are retained without extractor edits or reruns. Skipped AI cases are untested, never counted as passes.
