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
npx next typegen
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
Historical, not reproduced: every row below was recorded at the commit named in its phase and has not been re-run under the current code. Current numbers are in Measurements.

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
Historical, not reproduced (recorded at MAC-1B, before the smoke gate and CX-09 checks). Current smoke results are in Measurements.

- localhost prod build (flag 1): 16/16 PASS, including the bundle scan (no secrets in 38 client files) and check 14 speak guarded (no key 401, keyed 503)
- prod (https://maang-alpha.vercel.app): 15/15 PASS. The bundle scan runs locally only.

Covered: create, cluster board, add stock, notify, 5 concurrent reserves → exactly 1 ok and stock never negative, out_of_stock for the loser, double pickup → one event, cancel releases stock, prompt-injection text stays inert, wrong token 404, missing key 401, speak route guarded, and reset restores the seed.

## Soundbox screen
`NEXT_PUBLIC_SOUNDBOX=1` (prod is 1, code default off; inlined at build, so redeploy after changing it). The board shows a one-time "Soundbox voice on" button that unlocks audio. New request → "Nayi maang: {item}, {budget} rupaye tak"; after notify → "{n} customers ko bata diya gaya." The same line is always shown on the board, so it reads on a projector without audio. `POST /api/merchant/[shop]/speak` is merchant-key protected, 1 call per 3 s per shop, builds text on the server (max 120 chars), and returns 503 when Sarvam speech fails or is not configured.

## Demo order
1. Judge scans the counter QR (/m/neighbourhood-toys/qr) and says a request on /s, e.g. "Remote control car chahiye, rechargeable, 1000 ke andar, kal tak".
2. Board announces it: Soundbox says "Nayi maang: …" (tap "Soundbox voice on" once first) and the rc_car cluster count goes up.
3. Stock aa gaya → Save stock.
4. Customers ko batao → Soundbox says "{n} customers ko bata diya gaya."
5. Customer reserves on the phone from their status page.
6. Merchant marks pickup.
7. Then the urgent "das minute" request: close it honestly with "Nahi ho paayega".

## AI evaluation
Current numbers are under Measurements, scored with the strict scorer (exact hard-constraint sets, actual mode recorded). Everything below is historical, not reproduced under that scorer.

Merge gate (voice branch RESULTS.md at 227bfcb, 14 cases): AI text 30/34 field checks (88%), case 1 and case 4 pass; rules fallback 31/34; AI extract p50 930 ms, max 1100 ms. Historical, not reproduced.

An earlier rerun after merge (21 cases incl. cross-vertical, 2026-10-31 13:36 IST) quoted AI text 40/53 (75%) and rules fallback 37/53 (70%). That used the old lenient scorer. Historical, not reproduced under the new scorer; do not quote it.

Prod live checks after deploy 2ad1a73 (STT 200 on a TTS WAV in 1.3 s; extract for "Remote control car chahiye, rechargeable, 1000 ke andar, kal tak" returned mode ai, rc_car, [rechargeable], 1000, 2026-11-01 in 1.8 s; Soundbox speak 200): historical, not reproduced.

## Live vs fallback vs simulated
- **Live:** Sarvam speech to text (saaras:v3), AI extraction (sarvam-105b, JSON mode), Soundbox voice (bulbul:v3), typed capture, request storage, clustering and matching, restock, notify, reserve, cancel, pickup, close, expiry, consent masking, polling status page, merchant board, QR, reset, rate limits.
- **Fallback:** if Sarvam fails or times out, extract returns the rules result (mode rules_fallback, UI "basic mode" tag); transcribe returns 503 and the UI opens typed input; Soundbox stays silent but the text line still shows. The rules result also guards the AI result: AI never drops an item or hard constraint that rules found.
- **Simulated:** all seed data is synthetic and labelled. The "Demand-backed stock advance" tile is marked "Concept (not live)".

## Known limitations
- AI case 9: a colour is treated as a hard constraint (forbidden_hard_prefix 0/1). Still failing in the current run (see Measurements).
- Real phone recordings were run through Sarvam STT (6 of 6 ok, see Measurements) and a fake-mic browser flow reached the review screen, but a real iPhone or Android device has not yet passed the Device acceptance table. That table is the release gate.
- The Sarvam speech (TTS) step of the speech smoke returned HTTP 400. Open item, not investigated; it needs the Sarvam key, which agents may not read.
- Rules fallback is below its threshold (50% against 60%) and has no electronics words; see Measurements.
- Rate limits are in memory and per serverless instance.
- Polling runs every 3 s; there are no push notifications. The customer sees updates only on their status page.
- Shop names on the capture page come from a hardcoded map, with the slug as fallback.

## Env variables (names only)
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERCHANT_KEY, RESET_KEY, NEXT_PUBLIC_BASE_URL, SARVAM_API_KEY, SARVAM_STT_MODEL, SARVAM_CHAT_MODEL, SARVAM_TTS_MODEL, NEXT_PUBLIC_SOUNDBOX, SARVAM_EXTRACT_MODE. Vercel production has all of these except SARVAM_TTS_SPEAKER (deliberately unset).

## Voice lane
Merged at 2ad1a73 and live: lib/voice.ts exports sarvamLane (`export { sarvamLane as voice } from './sarvam'`); the app uses the real adapter. Rollback: set SARVAM_EXTRACT_MODE=rules and redeploy; if speech fails, point lib/voice.ts at the offline lane in lib/voice-stub.ts (`export { stubLane as voice } from "./voice-stub"`) and redeploy. That lane has no network, so transcribe and speak return 503 and the typed box is used.

## Device acceptance (release gate)

No release ships until every row below passes on real hardware. Simulated browsers (Chromium, WebKit under Playwright) do not count for this table.

| Scenario | Device / OS | Browser | Expected | Result | Telemetry line seen (Y/N) | Date |
|---|---|---|---|---|---|---|
| iPhone Safari | | Safari | Mic permission prompt appears once; a spoken request uploads, the transcript and extracted item reach the review screen | | | |
| Android Chrome | | Chrome | Same as iPhone: prompt, upload, transcript and extracted item on the review screen | | | |
| In-app browser (Instagram or WhatsApp) | | Instagram or WhatsApp in-app | "Safari ya Chrome" banner with a copy-link button; typed box visible and usable | | | |
| Permission denied | | any | "Mic ki permission nahi mili..." line; typed box visible and usable; no upload | | | |
| 1-second tap | | any | If the recording is under 0.5 s: "Bahut chhota tha..." line and no upload; a tap of about 1 s either reaches review or shows its own Hinglish line | | | |
| Noisy room | | any | Transcript reaches the review screen, or "Awaaz samajh nahi aayi..." with the typed box usable | | | |
| Typed fallback after a voice failure | | any | After any voice error above, typing the request and submitting still creates the request and opens the status page | | | |

Fill Device / OS, Result (pass or fail with a note), Telemetry and Date by hand at each release. Leave a failed row visible; do not delete it.

Telemetry: the capture page sends `POST /api/capture/telemetry` on voice events. In Vercel, open the project's function logs and filter for lines starting `[telemetry]`. They carry no audio, no transcript text and no phone number. Mark "Telemetry line seen" Y only if a `[telemetry]` line for that attempt appears.

## Smoke tests
`scripts/smoke/smoke.ts` is read-only by default and safe to run against production:

```sh
npx tsx --env-file=.env.local scripts/smoke/smoke.ts https://maang-alpha.vercel.app
```

`--destructive` creates, reserves, cancels and resets data. It runs only when `/api/health` reports `db_role=test`, which needs `MAANG_DB_ROLE=test` on the server and the `supabase/test-marker.sql` row in the database. Otherwise it prints "Destructive suite needs db_role=test (got prod)" and exits 2 before any write. `--destructive --demo-db` also allows the production demo database, after a 5 second warning; use it only when you accept a reset of demo data.

```sh
set -a; . ./.env.test; set +a; npx tsx scripts/smoke/smoke.ts http://localhost:3102 --destructive
```

Test database setup (local Supabase, no cloud project):
1. Install the Supabase CLI and Docker, then start a local stack (ports 563xx).
2. Apply `supabase/migrations/0001_init.sql`, `supabase/seed.sql` and `supabase/test-marker.sql` to it, in that order. The marker file adds the marker row and service_role grants.
3. Put the local URL, local service role key and `MAANG_DB_ROLE=test` in a git-ignored `.env.test` (variable names as in Env variables). Never print it.
4. Start the app with that env on port 3102 and run the command above.

A second hosted Supabase project was not used: a new project in the available org costs $10 a month (about ₹840 a month).

## Rotating MERCHANT_KEY
1. Generate a new key: `openssl rand -hex 24`.
2. In Vercel, set `MERCHANT_KEY` for Production and Preview, then redeploy.
3. Update `.env.local` (used by dev and by the smoke script).
4. Replace every printed or shared `/m/` link, including the Insights and settings links.
5. Open tabs clear their stored key on the first 401 and show "This key is wrong or has changed." Reopen the new link in them.
6. Decks and judges use `/demo`, never a keyed link.
7. The server trims whitespace from the key, so a trailing space or newline in the Vercel value is harmless.

## Measurements
All numbers below were measured on 2026-10-31 by the orchestrator, code on branch fix/post-audit (not yet on main). Anything elsewhere in this file without a stamp is historical, not reproduced.

- Unit tests: 188/188 pass via `npm test` (2026-10-31, commit 811ba09, npm test). `tsc` clean; ESLint on app, components, lib, scripts clean (2026-10-31, commit 811ba09, `npx tsc --noEmit`, `npx eslint`).
- Smoke, read-only plus destructive on the local test database: 31/31 passed, including checks 20 to 24 (opt-out not notified, pickup creates one event, close reason stored, repeated cancel is a no-op, mixed concurrent actions keep stock equal to units added minus units held) (2026-10-31, commit 811ba09, scripts/smoke/smoke.ts).
- Destructive gate: `--destructive` against a server with `MAANG_DB_ROLE=prod` on the test database printed "Destructive suite needs db_role=test (got prod)", exited 2, and the server log shows zero POST requests (2026-10-31, commit 811ba09, scripts/smoke/smoke.ts).
- Eval, strict scorer (exact hard-constraint sets, actual mode recorded, rules mode scores lib/voice-fallback.ts which the app runs): text cases, AI 13/14 (92.9%, threshold 70%), AI rows that fell back to rules 0; rules 7/14 (50%, below the 60% threshold, exit 1). Cross-vertical (7 xv- cases): AI 2/7, rules 0/7 (exit 1). AI extract latency over 14 text cases: p50 712 ms, max 1502 ms (2026-10-31, eval code at commit 811ba09, scripts/eval/RESULTS.md, scripts/eval/measurements.json, scripts/eval/cross-vertical-results.json).
- Real phone clips: 6 user recordings (.m4a) through Sarvam STT via scripts/eval/speech-smoke.ts: 6/6 ok, 155 to 1058 ms. Only clip ids, status and latency are logged; transcripts go to the git-ignored scripts/eval/private/. The TTS step of the same run returned HTTP 400, open item (2026-10-31, commit 811ba09, scripts/eval/speech-smoke.ts).
- Browser checks (Playwright scratch scripts, not in the repo): Chromium with a fake mic fed one of the clips reached the review screen (upload 200, transcript and AI extraction). Typed "RC car rechargeable nahi chahiye under 1000 tomorrow" shows "Not wanted: rechargeable" and no rechargeable chip. WebKit at 390x844 and 360x780: each voice error state (unsupported, in-app, denied, no audio, too short with zero uploads, empty transcript 422, server 503) shows its own Hinglish line with the typed box visible and no horizontal scroll; in-app shows the "Safari ya Chrome" banner and copy button; telemetry POSTs fire. Merchant key: 14/14 in Chromium and WebKit (header only, never in the URL; bare link works in the same tab; a wrong key stops polling and clears the stored key; /demo sends no key) (2026-10-31, commit 811ba09, Playwright scratch scripts, not reproducible from the repo). A real iPhone or Android device is still the release gate.
- Not backed by an artifact in the repo, so historical, not reproduced: the 30/34 merge gate, 40/53 and 37/53 lenient-scorer figures, the Phase checks and MAC-1B smoke tables, the DEMO-MODE verification list, and the prod checks after 2ad1a73.

## Freeze
Frozen at tag demo-v1. Any later change goes on a hotfix/* branch and merges only if smoke passes again.

## DEMO-MODE verification — 2026-10-31
Historical, not reproduced: recorded at tag demo-v6b (commit 5e0c11b), before the fixes in this release. The current unit test count is in Measurements.


- 70 unit tests passed, including allowlist, recursive secret/contact redaction, unchanged real auth and limiter tests.
- `next typegen`, `tsc --noEmit`, ESLint on app/components/lib, and production build passed.
- Soundbox-enabled production build: all 21 fresh-context page/viewport cases passed (1440, 390, 360).
- Six missing/wrong-key merchant screens passed; no-key merchant board/Insights APIs returned 401 for both stores.
- Unknown demo slugs returned 404. Noindex, key-free GET-only traffic, disabled write controls and local settings preview passed.
- Client-secret scan passed across 41 static files. Screenshots visually reviewed for loaded data and responsive layout.
- No smoke, QA, eval, reset or database write was run. Production verification uses GET only.
