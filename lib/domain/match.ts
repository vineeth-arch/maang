import type { Product, ProductRejection } from '../api-types';
import { formatRs } from './format';

type Reason = { code: string; text: string };

function missingReason(c: string, product: Product): Reason {
  const code = `missing_constraint:${c}`;
  if (c === 'rechargeable' && product.tags.includes('disposable_batteries')) {
    return { code, text: 'uses AA batteries, customer needs rechargeable' };
  }
  if (c === 'disposable_batteries' && product.tags.includes('rechargeable')) {
    return { code, text: 'is rechargeable, customer asked for battery-cell type' };
  }
  if (c.startsWith('pieces:')) {
    const have = product.tags.find((t) => t.startsWith('pieces:'));
    if (have) {
      return { code, text: `has ${have.slice('pieces:'.length)} pieces, customer needs ${c.slice('pieces:'.length)}` };
    }
  }
  return { code, text: `does not meet: ${c}` };
}

export function matchProducts(
  r: { item_key: string | null; hard_constraints: string[]; max_budget: number | null },
  products: Product[],
): { eligible: Product[]; rejected: ProductRejection[] } {
  const eligible: Product[] = [];
  const rejected: ProductRejection[] = [];
  for (const product of products) {
    if (product.item_key !== r.item_key) continue;
    const reasons: Reason[] = [];
    for (const c of r.hard_constraints) {
      if (!product.tags.includes(c)) reasons.push(missingReason(c, product));
    }
    if (r.max_budget !== null && product.price > r.max_budget) {
      reasons.push({
        code: 'over_budget',
        text: `${formatRs(product.price)} is over budget ${formatRs(r.max_budget)}`,
      });
    }
    if (reasons.length === 0) eligible.push(product);
    else rejected.push({ product, reasons });
  }
  return { eligible, rejected };
}
