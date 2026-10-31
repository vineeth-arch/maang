# Production QA results

- Timestamp: 2026-10-31T09:42:11.574Z
- Commit: `5341e7106b884300b95bbcf8f9e4451ffe30a4b7`
- Base URL: https://maang-alpha.vercel.app
- Summary: 18/18 checks passed

| Result | Check | Measurement / detail |
|---|---|---|
| PASS | Health | HTTP 200 |
| PASS | Reset seed and baseline board | seed products=4, requests=6; RC-01 stock=0 |
| PASS | Store 2 customer page | HTTP 200 |
| PASS | Store 2 typed TV request joins seeded TV cluster | item_key=tv; cluster=tv\|size:55_inch,wall_mount\|5000+; seeded count=4 |
| PASS | Insights pages load for both stores | neighbourhood-toys=200; electronics-andheri=200 |
| PASS | Create 3 typed requests through rules extraction | 4 created; consent=true,true,false,true |
| PASS | Cluster and urgent lane placement | rc_car cluster=5; urgent lane=1, cluster=0 |
| PASS | Notify only consenting requests | notified_count=3; consenting=3; no-consent=open |
| PASS | 10 concurrent reserve calls | 10 calls; ok=1; RC-01 stock=0; negative stock=0 |
| PASS | Pickup reserved request twice | first=ok; second=already |
| PASS | Fresh notified request cancel releases stock | reserved stock 0; cancel closed; released stock=1 |
| PASS | Wrong token hides request and phone; missing merchant key is 401 | wrong token=404, phone leak=0; missing merchant key=401 |
| PASS | Injection text remains open request | source text stored; status=open; close_reason=null |
| PASS | Urgent request close removes it from active board | close_reason=cannot_meet_deadline; active-board occurrence=0 |
| PASS | Extractor latency: 5 AI and 5 rules runs | AI p50=1560.0 ms, max=1787.8 ms; rules p50=489.5 ms, max=523.8 ms |
| PASS | Rate limit: 15 request POSTs | 429=7/15; observed statuses=201,429; per-instance limit varies on Vercel |
| PASS | Read load: 30 concurrent board GETs (demo infrastructure, not Paytm scale) | p50=762.4 ms; p95=1034.7 ms; errors=0/30 (demo infrastructure, not Paytm scale) |
| PASS | Final reset | seed restored: products=4, requests=6, RC-01 stock=0 |
