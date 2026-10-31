import { negatedConstraints } from '@/lib/negation';

const LABELS: Record<string, string> = {
  rechargeable: 'rechargeable',
  disposable_batteries: 'cell wali battery',
  eggless: 'eggless',
  sugar_free: 'sugar free',
};

export function NotWanted({ text }: { text: string }) {
  const ids = negatedConstraints(text);
  if (ids.length === 0) return null;
  return <p className="mt-2 text-[13px] text-muted">Not wanted: {ids.map((id) => LABELS[id] ?? id).join(', ')}</p>;
}
