# MAANG

Lane rule: never edit lib/sarvam/, scripts/eval/, scripts/qa/. They belong to the voice branch. All app code reaches voice features only through lib/voice.ts.

- docs/ belongs to the other agent. Never create or edit files in docs/.
- `lib/contracts.ts` is frozen. Never change it.
- `lib/api-types.ts` is the shared shape contract between API routes, UI and smoke tests.
- All database access is server-side through `lib/db.ts` (service role). Never import it from client components.
- Never read, print or commit `.env.local`.

@AGENTS.md
