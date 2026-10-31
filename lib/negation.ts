// Which constraints did the customer say they do NOT want?
// Pure and browser-safe: no server imports, does its own normalisation.

type Id = 'rechargeable' | 'disposable_batteries' | 'eggless' | 'sugar_free';

const KEYWORDS: Array<[Id, string[]]> = [
  ['rechargeable', ['rechargeable']],
  ['rechargeable', ['charging', 'wala']],
  ['rechargeable', ['रिचार्जेबल']],
  ['rechargeable', ['चार्जिंग', 'वाला']],
  ['disposable_batteries', ['cell', 'wala']],
  ['disposable_batteries', ['aa', 'battery']],
  ['disposable_batteries', ['सेल', 'वाला']],
  ['eggless', ['eggless']],
  ['eggless', ['एगलेस']],
  ['sugar_free', ['sugar', 'free']],
  ['sugar_free', ['sugarfree']],
  ['sugar_free', ['sugarless']],
];

const AFTER = new Set(['nahi', 'nahin', 'नहीं', 'नही', 'mat', 'na']);
const BEFORE = new Set(['no', 'not', 'without', 'non', 'bina']);
const IS = new Set(['hai', 'है']);
const SUGAR = new Set(['cheeni', 'shakkar']);
const BREAK = '|';

function tokenise(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[,.;!?।]/g, ` ${BREAK} `)
    .replace(/[-_:()"'“”‘’]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function negatedConstraints(text: string): string[] {
  const t = tokenise(text);
  // owner[i] = index of the keyword occurrence covering token i, else -1.
  const owner = new Array<number>(t.length).fill(-1);
  const found: Array<{ id: Id; start: number; end: number }> = [];
  for (let i = 0; i < t.length; i++) {
    if (owner[i] !== -1) continue;
    for (const [id, words] of KEYWORDS) {
      if (words.every((w, k) => t[i + k] === w)) {
        found.push({ id, start: i, end: i + words.length });
        for (let k = 0; k < words.length; k++) owner[i + k] = found.length - 1;
        break;
      }
    }
  }

  const out = new Set<string>();
  found.forEach((f, n) => {
    const stops = (j: number) => t[j] === BREAK || (owner[j] !== -1 && owner[j] !== n);
    for (let j = f.end; j < Math.min(t.length, f.end + 3) && !stops(j); j++) {
      if (!AFTER.has(t[j])) continue;
      if (t[j - 2] === 'battery' && t[j - 1] === 'wala') continue; // "battery wala nahi" = rechargeable
      if (IS.has(t[j + 1])) continue; // "nahi hai": the shop is out of stock
      out.add(f.id);
    }
    for (let j = f.start - 1; j >= Math.max(0, f.start - 2) && !stops(j); j--) {
      if (!BEFORE.has(t[j])) continue;
      if (t[j] === 'bina' && SUGAR.has(t[j + 1])) continue; // "bina cheeni" = sugar free wanted
      out.add(f.id);
    }
  });
  return [...out].sort();
}
