// Shared scorer for scripts/eval/run.ts and scripts/eval/cross-vertical.ts.
import type { ExtractedRequest, RelativeDeadline } from '../../lib/contracts';
// Same resolveDeadline the app's rules engine (lib/voice-fallback.ts) uses to fill needed_by.
import { resolveDeadline } from '../../lib/voice-fallback';

export type Check = { field: string; expected: unknown; got: unknown; pass: boolean };

export const THRESHOLDS = { ai: 0.7, rules: 0.6 } as const;

const asSet = (value: unknown): Set<unknown> | null => (Array.isArray(value) ? new Set(value) : null);

function sameSet(got: unknown, expected: unknown[]): boolean {
  const g = asSet(got);
  const e = new Set(expected);
  return g !== null && g.size === e.size && [...e].every(v => g.has(v));
}

export function scoreCase(result: ExtractedRequest, expected: Record<string, unknown>, todayISO: string): Check[] {
  return Object.entries(expected).map(([field, want]) => {
    let got: unknown;
    let pass: boolean;
    switch (field) {
      case 'deadline_token':
        got = result.needed_by;
        pass = got === resolveDeadline(want as RelativeDeadline, todayISO);
        break;
      case 'forbidden_hard_prefix':
        got = result.hard_constraints;
        pass = !result.hard_constraints.some(c => c.startsWith(String(want)));
        break;
      case 'hard_constraints_subset':
        got = result.hard_constraints;
        pass = Array.isArray(want) && want.every(v => result.hard_constraints.includes(v));
        break;
      case 'soft_preferences_contains':
        got = result.soft_preferences;
        pass = result.soft_preferences.join(' ').toLowerCase().includes(String(want).toLowerCase());
        break;
      default:
        got = result[field as keyof ExtractedRequest] ?? null;
        if (field === 'item_key' && Array.isArray(want)) pass = want.includes(got);
        else if (Array.isArray(want)) pass = sameSet(got, want);
        else pass = got === want;
    }
    return { field, expected: want, got, pass };
  });
}

/** Fraction of rows where at least one check exists and every check passes; 0 when there are no rows. */
export function casePassRate(rows: { checks: Check[] }[]): number {
  if (!rows.length) return 0;
  return rows.filter(r => r.checks.length > 0 && r.checks.every(c => c.pass)).length / rows.length;
}

/** Prints "<label> case pass rate: X% (threshold Y%)" and returns whether the rate meets the threshold. */
export function reportPassRate(label: string, rows: { checks: Check[] }[], threshold: number): boolean {
  const rate = casePassRate(rows);
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  console.info(`${label} case pass rate: ${pct(rate)} (threshold ${pct(threshold)})`);
  return rate >= threshold;
}
