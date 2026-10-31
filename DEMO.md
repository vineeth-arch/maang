# MAANG demo sheet

MAANG captures the sale that did not happen. The customer says what the shop did not have, the merchant sees demand clustered on a board, restocks with one tap, notifies everyone who opted in, and they reserve. Demo shop "Neighbourhood Toys (demo)" uses synthetic data only.

## Prod URLs
- Customer capture: https://maang-alpha.vercel.app/s/neighbourhood-toys
- Status page (example shape): https://maang-alpha.vercel.app/r/<request-id>?t=<token>. You get this link right after submitting on the capture page.
- Merchant board: https://maang-alpha.vercel.app/m/neighbourhood-toys?k=<MERCHANT_KEY from .env.local>
- Printable counter QR: https://maang-alpha.vercel.app/m/neighbourhood-toys/qr

## Reset demo data (before each judge run)
```bash
cd "/Users/vineethnair/Vibe Code/maang" && node --env-file=.env.local -e "fetch('https://maang-alpha.vercel.app/api/admin/reset',{method:'POST',headers:{'x-reset-key':process.env.RESET_KEY}}).then(r=>r.json()).then(j=>console.log(j.counts))"
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

## Smoke results (MAC-1B)
- localhost prod build (flag 1): 16/16 PASS, including the bundle scan (no secrets in 38 client files) and check 14 speak guarded (no key 401, keyed 503)
- prod (https://maang-alpha.vercel.app): 15/15 PASS. The bundle scan runs locally only.

Covered: create, cluster board, add stock, notify, 5 concurrent reserves → exactly 1 ok and stock never negative, out_of_stock for the loser, double pickup → one event, cancel releases stock, prompt-injection text stays inert, wrong token 404, missing key 401, speak route guarded, and reset restores the seed.

## Soundbox screen
`NEXT_PUBLIC_SOUNDBOX=1` (prod is 1, code default off; inlined at build, so redeploy after changing it). The board shows a one-time "Soundbox voice on" button that unlocks audio. New request → "Nayi maang: {item}, {budget} rupaye tak"; after notify → "{n} customers ko bata diya gaya." The same line is always shown on the board, so it reads on a projector without audio. `POST /api/merchant/[shop]/speak` is merchant-key protected, 1 call per 3 s per shop, builds text on the server (max 120 chars), and returns 503 while voice is stubbed.

## Live vs stubbed vs simulated
- **Live:** typed capture, rules extraction, request storage, clustering and matching, restock, notify, reserve, cancel, pickup, close, expiry, consent masking, polling status page, merchant board, QR, reset, rate limit.
- **Stubbed:** voice transcription and voice output. The stub returns 503, and the UI says "Awaaz abhi nahi chal rahi. Likh ke batayein." and opens typed input. Soundbox audio is silent for the same reason; its text line is live.
- **Fallback:** AI extraction. The stub lane uses the rules extractor, and the UI shows a "basic mode" tag.
- **Simulated:** all seed data is synthetic and labelled. The "Demand-backed stock advance" tile is marked "Concept (not live)".

## Known limitations
- The rate limit (10/min/IP) is in memory and per serverless instance.
- Polling runs every 3 s; there are no push notifications. The customer sees updates only on their status page.
- The microphone was verified with an encoder test and the 503 path. A live phone recording has not been tested on iOS or Android hardware.
- Shop names on the capture page come from a hardcoded map, with the slug as fallback.
- `.env.example` was not created because a permission rule blocks `.env*` writes. The variable names are listed in the next section.

## Env variables (names only)
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERCHANT_KEY, RESET_KEY, NEXT_PUBLIC_BASE_URL, SARVAM_API_KEY, SARVAM_STT_MODEL, SARVAM_CHAT_MODEL, SARVAM_TTS_MODEL, SARVAM_TTS_SPEAKER, NEXT_PUBLIC_SOUNDBOX. Vercel production has every non-Sarvam variable.

## Voice lane swap (after the `voice` branch is ready)
1. `git merge voice` on main. It brings lib/sarvam/ and scripts/eval/ and scripts/qa/.
2. In `lib/voice.ts`, replace `export { stubLane as voice } from './voice-stub'` with `export { sarvamLane as voice } from './sarvam'`.
3. Add SARVAM_* variables to Vercel production, run `npm run build && npm test`, deploy, and run the smoke test again.
