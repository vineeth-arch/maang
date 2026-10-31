const BUCKETS = [250, 500, 1000, 2000, 5000];

const ITEM_NAMES: Record<string, string> = {
  rc_car: 'RC car',
  gift_hamper: 'Gift hamper',
  jigsaw_puzzle: 'Jigsaw puzzle',
  cricket_bat: 'Cricket bat',
};

export function budgetBucket(max: number | null): string {
  if (max === null) return 'any';
  for (const b of BUCKETS) if (b >= max) return String(b);
  return '5000+';
}

export function clusterKey(r: {
  urgent: boolean;
  item_key: string | null;
  hard_constraints: string[];
  max_budget: number | null;
}): string | null {
  if (r.urgent || r.item_key === null) return null;
  return `${r.item_key}|${[...r.hard_constraints].sort().join(',')}|${budgetBucket(r.max_budget)}`;
}

function sentenceCase(snake: string): string {
  const s = snake.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inr(n: number): string {
  return '₹' + n.toLocaleString('en-IN');
}

export function clusterLabel(item_key: string, hard_constraints: string[], bucket: string): string {
  const itemName = ITEM_NAMES[item_key] ?? sentenceCase(item_key);
  const prefixes: string[] = [];
  let suffix = '';
  for (const c of hard_constraints) {
    if (c === 'rechargeable') prefixes.push('Rechargeable');
    else if (c === 'disposable_batteries') prefixes.push('AA-battery');
    else if (c.startsWith('pieces:')) suffix = `${c.slice('pieces:'.length)} pieces`;
    else if (c.includes(':')) prefixes.push(c.slice(c.indexOf(':') + 1).replace(/_/g, ' '));
    else prefixes.push(c.replace(/_/g, ' '));
  }
  let name = itemName;
  if (prefixes.length > 0) {
    const second = itemName.charAt(1);
    const lowered =
      second !== '' && second === second.toUpperCase() && second !== second.toLowerCase()
        ? itemName
        : itemName.charAt(0).toLowerCase() + itemName.slice(1);
    const joined = `${prefixes.join(' ')} ${lowered}`;
    name = joined.charAt(0).toUpperCase() + joined.slice(1);
  }
  if (suffix) name = `${name}, ${suffix}`;
  const parts = [name];
  if (bucket === '5000+') parts.push(`over ${inr(5000)}`);
  else if (bucket !== 'any') parts.push(`under ${inr(Number(bucket))}`);
  return parts.join(' · ');
}
