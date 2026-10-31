# MAANG evidence

## Production QA

- 18/18 production QA checks passed on 2026-10-31.
- End-to-end verified: typed capture, stored request, cluster placement, consent-gated notification, reserve, pickup, cancel, urgent close, merchant insights pages for both stores, and reset.
- Reserve race: 1 success in 10 calls; final stock 0; negative stock 0.
- Extract endpoint latency: `mode=ai` requests p50 1,335.0 ms (max 1,846.2 ms); `mode=rules` p50 494.4 ms (max 667.3 ms).
- Rate probe: 7 of 15 create requests returned 429; 8 returned 201.
- Board reads: 30 concurrent, p50 1,384.7 ms, p95 1,740.1 ms, 0 errors. Demo infrastructure, not Paytm scale.

## Extraction evaluation

From `scripts/eval/RESULTS.md`:

- Core text field checks: AI 30/34 (88%); rules fallback 31/34 (91%).
- Cross-vertical field checks: AI 12/19 (63%); rules 6/19 (32%).
- Combined field checks: AI 42/53 (79%); rules fallback 37/53 (70%).
- Core evaluation extract p50: AI 930 ms; rules fallback 0 ms, 14 cases each.
- Audio AI field checks: 0/0 labelled cases. Results report 1 synthetic TTS call and 1 synthetic STT call; no real-clip transcription result.

## Live, fallback, simulated

- Live and verified here: typed requests persist and cluster; merchants notify, reserve, pick up, cancel, and close requests; both store insights pages return HTTP 200; reset restores seed counts.
- Fallback measured here: rules extraction returned HTTP 200 for five `mode=rules` requests. Evaluation records a separate rules-fallback field score.
- Simulated: reset seeds synthetic requests and insight history. Final reset returned store 1 counts of 4 products, 6 requests, 0 reservations, 6 events; store 2 counts of 6 products, 17 requests, 0 reservations, 18 events.
