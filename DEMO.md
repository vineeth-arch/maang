# Public deck links (DEMO-MODE)

Use these key-free URLs in the deck:

- https://maang-alpha.vercel.app/demo
- https://maang-alpha.vercel.app/demo/toys/board
- https://maang-alpha.vercel.app/demo/toys/insights
- https://maang-alpha.vercel.app/demo/toys/settings
- https://maang-alpha.vercel.app/demo/electronics/board
- https://maang-alpha.vercel.app/demo/electronics/insights
- https://maang-alpha.vercel.app/demo/electronics/settings

The seven landing cards cover the six store views plus the demo overview. All demo views show
"Demo view, synthetic data" and "Demo view is read-only. The presenter runs the live flow."
The only navigation outside `/demo` is the explicitly labelled, existing public customer page.
That customer flow remains live; do not submit it during read-only verification.

## Boundaries

`lib/demo.ts` is the single public allowlist: toys = `neighbourhood-toys`, electronics =
`electronics-andheri`. Shared merchant components receive `demo`; no merchant key is read,
embedded, stored or sent by demo pages. GET `/api/demo/board/[slug]` and
`/api/demo/insights/[slug]` reuse the real builders, selecting synthetic requests/products/history.
Recursive redaction removes phone fields (including masked phones), tokens, credentials,
embedded environment strings and phone-like text. Errors return fixed messages without logging data.
Real auth and its constant-time comparison are unchanged.

Notify, stock save, reserve, pickup, cancel, close, reset, Soundbox speak and settings save
cannot run through demo views. Existing customer reserve/cancel and admin reset are not exposed.
Settings turnover/location controls are local previews only. Stock sheets and request lists
can be opened for inspection; their write controls are disabled. Counter QR is disabled;
use the labelled customer link instead.

**DEMO_ACTIONS: optional feature not implemented; no action routes or env switch exist.**
Actions are therefore always OFF, including if someone sets `DEMO_ACTIONS=1`.
Nothing was enabled in Vercel. A future opt-in implementation must restrict actions to
notify/reserve/pickup/close for these two stores, enforce 20/min/IP, and never enable
reset, settings save or speak.

Read APIs enforce 120 requests/minute/IP across board and Insights with 429 + Retry-After.
This reuses the existing in-memory limiter: limits are per server instance, not distributed.
Demo pages send `noindex, nofollow` metadata. API responses are `no-store`.

## Safe verification (shared production database)

Never run smoke, QA, eval or reset for this change. Run:

```sh
npm run test:unit
npx tsc --noEmit
npx eslint app/ components/ lib/
npm run build
npm run start -- --port 3100
# Separate terminal, with Playwright available (or PLAYWRIGHT_MODULE set to its installed path):
node --env-file=.env.local scripts/verify-demo.cjs
```

`PLAYWRIGHT_EXECUTABLE` optionally selects an already installed Chromium binary.
The browser verifier uses only GET requests, fresh contexts for all seven URLs at 1440×900,
390×844 and 360×844, checks banner/noindex/navigation/key-free requests/disabled writes,
and exercises local settings previews. Screenshots and verification.json go to
`~/Desktop/maang-deck-shots/demo/`. Unit tests use inert credentials and never access the DB.
Keep `demo-v6` at `f9cf027` as fallback. Deploy/tag `demo-v6b` only after all checks pass.

---

# MAANG demo sheet

MAANG captures the sale that did not happen. The customer says what the shop did not have, the merchant sees demand clustered on a board, restocks with one tap, notifies everyone who opted in, and they reserve. Demo shop "Neighbourhood Toys (demo)" uses synthetic data only.

## Prod URLs
- Customer capture: https://maang-alpha.vercel.app/s/neighbourhood-toys
- Status page (example shape): https://maang-alpha.vercel.app/r/<request-id>?t=<token>. You get this link right after submitting on the capture page.
- Merchant board: https://maang-alpha.vercel.app/m/neighbourhood-toys?k=<MERCHANT_KEY from .env.local>
- Printable counter QR: https://maang-alpha.vercel.app/m/neighbourhood-toys/qr
- Insights (MAC-4, small tier): https://maang-alpha.vercel.app/m/neighbourhood-toys/insights?k=<MERCHANT_KEY>
- Who are you? (merchant size): https://maang-alpha.vercel.app/m/neighbourhood-toys/settings?k=<MERCHANT_KEY>
- Insights data: 30 days of synthetic demand plus live requests; reset re-seeds it. Store 1 seeds as small tier (headline, festivals, top items, compact 30-day bars with the festival line); pick another band on "Who are you?" to see the medium view (table, day and hour charts, CSV).
- Board (MAC-5): every board has a filled "Insights →" button and, under the shop name, the top restock line (e.g. "Restock now: Rechargeable RC car. Diwali in 8 days.") linking to Insights.
- Recommendation rules (lib/insights-local.ts, live): skip if 1 or fewer requests in 30 days; restock now if (rising and 5+ requests in the last 7 days) or (3+ in the last 7 days and a matching festival is inside its window); otherwise watch. Rising = last 7 days at least 1.5x the 7 days before and at least 3 more. Codex lib/insights is merged but not switched on: 3 of 8 seeded items differ (cricket bat, laptop, earbuds).

## Store 2: Galaxy Digital, Andheri (MAC-3)
Fictional electronics chain branch ("branch 1 of many"), synthetic data only. Same loop, same merchant key.
- Customer capture: https://maang-alpha.vercel.app/s/electronics-andheri
- Merchant board: https://maang-alpha.vercel.app/m/electronics-andheri?k=<MERCHANT_KEY>
- Printable counter QR: https://maang-alpha.vercel.app/m/electronics-andheri/qr
- Insights (MAC-4, very large tier, 3 branches): https://maang-alpha.vercel.app/m/electronics-andheri/insights?k=<MERCHANT_KEY>
- Seeded clusters: Samsung Galaxy 256 GB blue (6, 2 due tomorrow), 55 inch TV with wall mount under ₹45,000 (4, Sunday), noise cancelling earbuds under ₹3,000 (3), 16 GB RAM laptop under ₹60,000 (3, by Monday). The urgent 1.5 ton AC for today is closed as "cannot meet deadline". The in-stock 55 inch TV at ₹42,000 is rejected on the board: no wall mount kit.
- Spoken requests: item_key comes from the store's own catalogue, and constraints snap to its product tags, so "55 inch ka TV 45000 ke andar, wall mount ke saath" joins the seeded TV cluster. Say a budget for the laptop ("60000 ke andar"), or it starts its own cluster. Rules fallback has no electronics words, so without AI a store 2 request gets no item and is not clustered (typed item field shows).

## Reset demo data (before each judge run)
Reseeds both stores. Prints store 1 counts (4 products, 6 requests) and store 2 counts (6 products, 17 requests).
```bash
cd "/Users/vineethnair/Vibe Code/maang" && node --env-file=.env.local -e "fetch('https://maang-alpha.vercel.app/api/admin/reset',{method:'POST',headers:{'x-reset-key':process.env.RESET_KEY}}).then(r=>r.json()).then(j=>console.log(j.counts,j.store2))"
```
Expected output: `{ products: 4, requests: 6, reservations: 0, events: 6 }`. The key is read from `.env.local` and never printed.

## Phase checks
| Phase | Result | Measured |
|---|---|---|
| P0 scaffold + contract + prod hello | PASS | build green, prod HTTP 200, commit 7289c86 |
| P1 typed flow + DB | PASS | UI create → /r persists; wrong token 404; board without key 401 |
| P2 voice capture | PASS | WAV 16 kHz mono PCM16, 32,044 B / 1,000 ms; transcribe 503 → typed input |
| P3 domain + flow | PASS | 33/33 unit tests (fallback 19, domain 13, wav 1) |
| P4 polish + reset | PASS | reset → 4 products, 6 requests, RC-01 stock 0 |
| P5 smoke | PASS | local 15/15 incl. bundle scan, prod 14/14 |
| S1 soundbox screen (MAC-1B) | PASS | flag 0: no button, 0 /speak calls; flag 1: line shows, speak 503 silent, notify 200 unaffected; limiter 503 → 429 within 3 s |
| S2 polish (MAC-1B) | PASS | AA contrast 17/17 token pairs; /s typed path 10.4 s, 3 taps (scripted); 0 hex literals in merchant UI; 38/38 unit tests |
| S3 ship (MAC-1B) | PASS | local 16/16, prod 15/15, prod reset → seed |
| P6 voice merge (MAC-2) | PASS | gate 30/34 (88%); local STT 200, AI extract 2.0 s, cluster 2→3; no-key degrade to basic mode |
| P7 Soundbox real TTS | PASS | speak 200, 3.58 s clip played on the board |
| P8 ship (MAC-2) | PASS | prod smoke 15/15 on 2ad1a73; prod STT/extract/speak 200 |

## Smoke results (MAC-1B)
- localhost prod build (flag 1): 16/16 PASS, including the bundle scan (no secrets in 38 client files) and check 14 speak guarded (no key 401, keyed 503)
- prod (https://maang-alpha.vercel.app): 15/15 PASS. The bundle scan runs locally only.

Covered: create, cluster board, add stock, notify, 5 concurrent reserves → exactly 1 ok and stock never negative, out_of_stock for the loser, double pickup → one event, cancel releases stock, prompt-injection text stays inert, wrong token 404, missing key 401, speak route guarded, and reset restores the seed.

## Soundbox screen
`NEXT_PUBLIC_SOUNDBOX=1` (prod is 1, code default off; inlined at build, so redeploy after changing it). The board shows a one-time "Soundbox voice on" button that unlocks audio. New request → "Nayi maang: {item}, {budget} rupaye tak"; after notify → "{n} customers ko bata diya gaya." The same line is always shown on the board, so it reads on a projector without audio. `POST /api/merchant/[shop]/speak` is merchant-key protected, 1 call per 3 s per shop, builds text on the server (max 120 chars), and returns 503 while voice is stubbed.

## Demo order
1. Judge scans the counter QR (/m/neighbourhood-toys/qr) and says a request on /s, e.g. "Remote control car chahiye, rechargeable, 1000 ke andar, kal tak".
2. Board announces it: Soundbox says "Nayi maang: …" (tap "Soundbox voice on" once first) and the rc_car cluster count goes up.
3. Stock aa gaya → Save stock.
4. Customers ko batao → Soundbox says "{n} customers ko bata diya gaya."
5. Customer reserves on the phone from their status page.
6. Merchant marks pickup.
7. Then the urgent "das minute" request: close it honestly with "Nahi ho paayega".

## AI evaluation
Merge gate (voice branch RESULTS.md at 227bfcb, 14 cases): AI text 30/34 field checks (88%), case 1 and case 4 pass; rules fallback 31/34; AI extract p50 930 ms, max 1100 ms.

Rerun after merge (21 cases incl. cross-vertical, 2026-10-31 13:36 IST): AI text 40/53 (75%), rules fallback 37/53 (70%); AI extract p50 855 ms, max 1467 ms (n=21). Audio AI 0/0: no labelled audio cases.

Prod live checks after deploy 2ad1a73: STT 200 on a TTS WAV in 1.3 s; extract for "Remote control car chahiye, rechargeable, 1000 ke andar, kal tak" → mode ai, rc_car, [rechargeable], 1000, 2026-11-01 in 1.8 s; Soundbox speak 200 (WAV).

## Live vs fallback vs simulated
- **Live:** Sarvam speech to text (saaras:v3), AI extraction (sarvam-105b, JSON mode), Soundbox voice (bulbul:v3), typed capture, request storage, clustering and matching, restock, notify, reserve, cancel, pickup, close, expiry, consent masking, polling status page, merchant board, QR, reset, rate limits.
- **Fallback:** if Sarvam fails or times out, extract returns the rules result (mode rules_fallback, UI "basic mode" tag); transcribe returns 503 and the UI opens typed input; Soundbox stays silent but the text line still shows. The rules result also guards the AI result: AI never drops an item or hard constraint that rules found.
- **Simulated:** all seed data is synthetic and labelled. The "Demand-backed stock advance" tile is marked "Concept (not live)".

## Known limitations
- AI case 9: a colour is treated as a hard constraint (forbidden_hard_prefix 0/1).
- Real microphone speech is untested until Vineeth's phone check; STT was verified only with TTS round-trip audio.
- Rate limits are in memory and per serverless instance.
- Polling runs every 3 s; there are no push notifications. The customer sees updates only on their status page.
- Shop names on the capture page come from a hardcoded map, with the slug as fallback.

## Env variables (names only)
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERCHANT_KEY, RESET_KEY, NEXT_PUBLIC_BASE_URL, SARVAM_API_KEY, SARVAM_STT_MODEL, SARVAM_CHAT_MODEL, SARVAM_TTS_MODEL, NEXT_PUBLIC_SOUNDBOX, SARVAM_EXTRACT_MODE. Vercel production has all of these except SARVAM_TTS_SPEAKER (deliberately unset).

## Voice lane
Merged at 2ad1a73: lib/voice.ts exports sarvamLane. Rollback: set SARVAM_EXTRACT_MODE=rules and redeploy; if speech fails, restore `export { stubLane as voice } from "./voice-stub"` in lib/voice.ts and redeploy.

## Freeze
Frozen at tag demo-v1. Any later change goes on a hotfix/* branch and merges only if smoke passes again.
