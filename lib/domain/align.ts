// Snap extracted hard constraints to the shop's own catalogue tag spellings, so a spoken request
// lands in the same cluster as seeded ones ("size:55 inches" -> "size:55_inch", "wall mount" -> "wall_mount").
// Only tags of products with the same item_key are used, so other items and other shops are untouched.
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const value = (t: string) => flat(t.includes(':') ? t.slice(t.indexOf(':') + 1) : t);
const digits = (v: string) => v.replace(/[^0-9]/g, '');
const letters = (v: string) => v.replace(/[0-9]/g, '');

// Same number and one unit word is a prefix of the other (55inch ~ 55inches), or one side has no unit (55 ~ 55inch).
function same(a: string, b: string): boolean {
  if (digits(a) !== digits(b)) return false;
  const la = letters(a), lb = letters(b);
  if (digits(a) !== '' && (la === '' || lb === '')) return true;
  return la === lb || (la.length >= 2 && lb.length >= 2 && (la.startsWith(lb) || lb.startsWith(la)));
}

export function alignToCatalog<T extends { item_key: string | null; hard_constraints: string[]; source_text: string }>(
  ex: T,
  products: { item_key: string; tags: string[] }[],
): T {
  if (!ex.item_key) return ex;
  const tags = [...new Set(products.filter((p) => p.item_key === ex.item_key).flatMap((p) => p.tags))];
  if (tags.length === 0) return ex;
  const out = new Set(ex.hard_constraints.map((c) => tags.find((t) => same(value(t), value(c))) ?? c));
  // Spoken but missed by extraction. Pure numbers (pieces:500) are skipped: a budget like "500" must not add them.
  const text = flat(ex.source_text);
  for (const t of tags) if (/[a-z]/.test(value(t)) && text.includes(value(t))) out.add(t);
  return { ...ex, hard_constraints: [...out].sort() };
}
