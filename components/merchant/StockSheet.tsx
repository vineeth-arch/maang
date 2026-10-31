'use client';

import { useState } from 'react';
import type { Cluster, NotifyResponse, StockResponse } from '@/lib/api-types';
import { formatINR } from '@/lib/domain';
import type { Ctx } from './api';

export function StockSheet({ cluster, ctx, onClose }: { cluster: Cluster; ctx: Ctx; onClose: () => void }) {
  const [productId, setProductId] = useState<string>(cluster.eligible[0]?.id ?? '');
  const [qty, setQty] = useState(1);

  const chosen = cluster.eligible.find((p) => p.id === productId) ?? null;
  const stockKey = `stock:${cluster.key}`;
  const notifyKey = `notify:${cluster.key}`;
  const n = cluster.count_consenting;
  const canNotify = n > 0 && chosen !== null && chosen.stock_available > 0 && !ctx.busy.has(notifyKey);

  async function save() {
    if (!chosen) return;
    await ctx.run<StockResponse>(stockKey, '/stock', { product_id: chosen.id, add_quantity: qty });
  }

  async function notify() {
    if (!chosen) return;
    const res = await ctx.run<NotifyResponse>(notifyKey, '/clusters/notify', {
      cluster_key: cluster.key,
      product_id: chosen.id,
    });
    if (!res) return;
    const skipped: string[] = [];
    if (res.skipped_no_consent > 0) skipped.push(`${res.skipped_no_consent} no consent`);
    if (res.skipped_ineligible > 0) skipped.push(`${res.skipped_ineligible} not eligible`);
    ctx.toast(
      `${res.notified_count} customers ko bata diya${skipped.length ? ` (skipped: ${skipped.join(', ')})` : ''}`,
    );
    if (res.notified_count > 0) ctx.announce?.(res.notified_count);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stock aa gaya"
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
    >
      <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-t-2xl border border-board-fg/20 bg-board-bg p-6 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-mono text-board-fg/70">Stock aa gaya</p>
            <h2 className="font-display mt-1 text-3xl font-semibold text-board-fg">{cluster.label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="label-mono min-h-12 shrink-0 rounded-md border border-board-fg/30 px-4 text-board-fg"
          >
            Band karo
          </button>
        </div>

        <fieldset className="mt-6">
          <legend className="label-mono text-board-fg/70">Product</legend>
          <div className="mt-2 space-y-2">
            {cluster.eligible.map((p) => (
              <label
                key={p.id}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 ${
                  p.id === productId ? 'border-board-fg' : 'border-board-fg/20'
                }`}
              >
                <input
                  type="radio"
                  name="product"
                  checked={p.id === productId}
                  onChange={() => setProductId(p.id)}
                  className="h-5 w-5 accent-board-fg"
                />
                <span className="flex-1 text-lg text-board-fg">
                  {p.name} · {formatINR(p.price)}
                </span>
                <span className={`label-mono ${p.stock_available > 0 ? 'text-board-ok' : 'text-board-fg/60'}`}>
                  {p.stock_available} in stock
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex items-center gap-3">
          <span className="label-mono text-board-fg/70">Quantity</span>
          <button
            type="button"
            aria-label="Kam karo"
            disabled={qty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-12 w-12 rounded-md border border-board-fg/30 text-2xl text-board-fg disabled:opacity-40"
          >
            −
          </button>
          <span className="font-display w-12 text-center text-4xl font-semibold text-board-fg">{qty}</span>
          <button
            type="button"
            aria-label="Badhao"
            disabled={qty >= 50}
            onClick={() => setQty((q) => Math.min(50, q + 1))}
            className="h-12 w-12 rounded-md border border-board-fg/30 text-2xl text-board-fg disabled:opacity-40"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={ctx.demo || !chosen || ctx.busy.has(stockKey)}
            className="ml-auto min-h-12 rounded-md border border-board-fg px-6 text-lg font-semibold text-board-fg disabled:opacity-50"
          >
            {ctx.busy.has(stockKey) ? 'Saving…' : 'Save'}
          </button>
        </div>
        {ctx.errors[stockKey] && <p className="label-mono mt-2 text-board-error">{ctx.errors[stockKey]}</p>}

        <button
          type="button"
          onClick={() => void notify()}
          disabled={ctx.demo || !canNotify}
          className="mt-8 min-h-14 w-full rounded-md bg-board-fg px-6 text-xl font-semibold text-board-bg disabled:opacity-40"
        >
          Customers ko batao ({n})
        </button>
        {ctx.errors[notifyKey] && <p className="label-mono mt-2 text-board-error">{ctx.errors[notifyKey]}</p>}
        {chosen !== null && chosen.stock_available === 0 && (
          <p className="label-mono mt-2 text-board-fg/70">Pehle stock save karo.</p>
        )}
      </div>
    </div>
  );
}
