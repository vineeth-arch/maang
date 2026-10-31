export type GateResult = 'readonly' | 'run' | 'warn' | 'refuse';

// Decides whether the destructive smoke suite may run, from the db_role reported by /api/health.
export function gate(
  role: string | undefined,
  flags: { destructive: boolean; demoDb: boolean },
): GateResult {
  if (!flags.destructive) return 'readonly';
  if (role === 'test') return 'run';
  if (role === 'prod' && flags.demoDb) return 'warn';
  return 'refuse';
}
