# Production QA evidence

- Date: 2026-10-31 (IST)
- Target: `https://maang-alpha.vercel.app`
- Live tag and commit: `demo-v4` at `a6e5c1c`
- Final runner result: 18/18 checks passed; completed 2026-10-31 09:42 UTC (15:12 IST)
- QA credentials: loaded from `.env.local`; values were not printed.

## Store coverage

| Check | Result |
|---|---|
| Neighbourhood Toys customer capture page | HTTP 200 |
| Electronics Andheri customer capture page | HTTP 200 |
| Typed request: “55 inch ka TV 45000 ke andar, wall mount ke saath” | Extracted `item_key=tv`; joined seeded `tv|size:55_inch,wall_mount|5000+` cluster; seeded cluster had 4 active requests |
| Insights page, neighbourhood-toys | HTTP 200 |
| Insights page, electronics-andheri | HTTP 200 |

## Flow and capacity observations

| Check | Measurement |
|---|---|
| Health | HTTP 200 |
| Toys seeded baseline | 4 products, 6 requests; `RC-01` stock 0 |
| Toys typed request creation | 4 created: 2 consenting, 1 no-consent, 1 urgent |
| Toys active lanes | RC cluster count 5; urgent lane 1; urgent cluster count 0 |
| Consent-gated notify | 3 notified; no-consent request remained open |
| Concurrent reservation race | 10 calls for one unit; 1 `ok`; stock 0 afterward; negative stock count 0 |
| Duplicate pickup | First `ok`; second `already` |
| Cancel reservation | Held stock 0; cancel closed request and restored stock to 1 |
| Token and auth | Wrong token 404; phone leak 0; missing merchant key 401 |
| Injection text | Stored unchanged; request stayed open; close reason null |
| Urgent close | Closed with `cannot_meet_deadline`; active-board occurrences 0 |
| Extract latency, AI | 5 runs; p50 1,560.0 ms; max 1,787.8 ms |
| Extract latency, rules | 5 runs; p50 489.5 ms; max 523.8 ms |
| Create rate limit | 15 POSTs; 7 returned 429, 8 returned 201; per-instance behavior observed on Vercel |
| Board reads | 30 concurrent; p50 762.4 ms; p95 1,034.7 ms; errors 0/30 |

Latency figures are one production QA run, not a capacity guarantee. The board measurement describes this demo deployment only. Rate limiting is per serverless instance, so 7/15 is an observation, not a stable global quota.

## Final reset

Documented reset endpoint returned HTTP 200. Seed counts:

| Store | Products | Requests | Reservations | Events |
|---|---:|---:|---:|---:|
| neighbourhood-toys | 4 | 6 | 0 | 6 |
| electronics-andheri | 6 | 17 | 0 | 18 |

Both stores are restored to synthetic seed data. `RC-01` stock is 0.
