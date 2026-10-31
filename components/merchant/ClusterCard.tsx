'use client';

import { useState } from 'react';
import type { Cluster, ProductRejection } from '@/lib/api-types';
import { formatDeadline, formatINR } from '@/lib/domain';
import type { Ctx } from './api';
import { RequestRow } from './RequestRow';

function stockText(stock: number): string {
  return `${stock} in stock`;
}

// Derive "does not meet: ..." from reason codes.
function doesNotMeet(rej: ProductRejection): string {
  const parts: string[] = [];
  for (const r of rej.reasons) {
    if (r.code.startsWith('missing_constraint:')) parts.push(r.code.slice('missing_constraint:'.length));
    else if (/budget/i.test(r.code)) parts.push('budget');
    else parts.push(r.text);
  }
  return parts.join(', ');
}

function Rejected({ list }: { list: ProductRejection[] }) {
  if (list.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1">
      {list.map((rej) => (
        <li key={rej.product.id} className="text-base text-[#EEEAE0]/70">
          <span className="text-[#EEEAE0]/90">
            {rej.product.name} · {formatINR(rej.product.price)}
          </span>{' '}
          — {rej.reasons.map((r) => r.text).join('; ')}
        </li>
      ))}
    </ul>
  );
}

export function ClusterCard({
  cluster,
  ctx,
  newIds,
  noMatch,
  onStock,
}: {
  cluster: Cluster;
  ctx: Ctx;
  newIds: ReadonlySet<string>;
  noMatch: boolean;
  onStock: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasNew = cluster.requests.some((r) => newIds.has(r.id));

  return (
    <article
      className={`rounded-xl border bg-[#EEEAE0]/[0.03] p-5 ${
        hasNew ? 'border-transparent outline outline-2 outline-[#FF0A6C]' : 'border-[#EEEAE0]/15'
      }`}
    >
      <p className="label-mono text-[#EEEAE0]/70">{noMatch ? 'Not in your catalogue' : cluster.label}</p>
      {noMatch && <h3 className="font-display mt-1 text-2xl font-semibold text-[#EEEAE0]">{cluster.label}</h3>}

      <div className="mt-2 flex items-end gap-4">
        <span className="font-display text-7xl font-bold leading-none text-[#EEEAE0]">{cluster.count_active}</span>
        <div className="pb-1">
          <p className="text-xl text-[#EEEAE0]">log maang rahe hain</p>
          {!noMatch && <p className="text-lg text-[#EEEAE0]/70">{cluster.count_consenting} can be told</p>}
        </div>
      </div>
      <p className="label-mono mt-3 text-[#EEEAE0]/70">
        Chahiye: {formatDeadline(cluster.earliest_needed_by, ctx.today)}
      </p>

      {!noMatch && cluster.eligible.length > 0 && (
        <ul className="mt-4 space-y-1">
          {cluster.eligible.map((p) => (
            <li key={p.id} className="text-lg text-[#EEEAE0]">
              {p.name} · {formatINR(p.price)} ·{' '}
              <span className={p.stock_available > 0 ? 'text-[#4CC38A]' : 'text-[#EEEAE0]/60'}>
                {stockText(p.stock_available)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Rejected list={cluster.rejected} />

      {cluster.in_stock_alternatives.length > 0 && (
        <ul className="mt-3 space-y-1">
          {cluster.in_stock_alternatives.map((rej) => (
            <li key={rej.product.id} className="text-base text-[#EEEAE0]/80">
              In-stock alternative (does not meet: {doesNotMeet(rej)}): {rej.product.name} ·{' '}
              {formatINR(rej.product.price)} · {stockText(rej.product.stock_available)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!noMatch && (
          <button
            type="button"
            onClick={() => onStock(cluster.key)}
            className="min-h-14 rounded-md bg-[#EEEAE0] px-6 text-xl font-semibold text-[#17130F]"
          >
            Stock aa gaya
          </button>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="label-mono min-h-12 rounded-md border border-[#EEEAE0]/30 px-4 text-[#EEEAE0]"
        >
          {open ? 'Hide' : 'Show'} {cluster.requests.length} requests
        </button>
      </div>

      {open && (
        <ul className="mt-4 space-y-3">
          {cluster.requests.map((r) => (
            <RequestRow key={r.id} r={r} ctx={ctx} highlight={newIds.has(r.id)} />
          ))}
        </ul>
      )}
    </article>
  );
}
