'use client';

import type { BoardRequest, CloseReason, CloseResponse, PickupResponse } from '@/lib/api-types';
import { formatDeadline, formatINR } from '@/lib/domain';
import type { Ctx } from './api';

const CLOSE_REASONS: { reason: CloseReason; label: string }[] = [
  { reason: 'cannot_meet_deadline', label: 'Cannot meet deadline' },
  { reason: 'not_stockable', label: 'Not stockable' },
  { reason: 'duplicate', label: 'Duplicate' },
  { reason: 'no_longer_needed', label: 'No longer needed' },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  notified: 'Told',
  reserved: 'Reserved',
  picked_up: 'Picked up',
  closed: 'Closed',
};

export function StatusPill({ status }: { status: string }) {
  const reserved = status === 'reserved';
  return (
    <span
      className={`label-mono inline-flex items-center rounded-full border px-2.5 py-1 ${
        reserved ? 'border-board-ok text-board-ok' : 'border-board-fg/30 text-board-fg/80'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="label-mono inline-flex items-center rounded-md border border-board-fg/20 px-2 py-1 text-board-fg/80">
      {children}
    </span>
  );
}

export function CloseMenu({ id, ctx, label = 'Close' }: { id: string; ctx: Ctx; label?: string }) {
  const key = `close:${id}`;
  const busy = ctx.busy.has(key);
  return (
    <details className="relative">
      <summary
        className={`label-mono flex min-h-12 cursor-pointer list-none items-center rounded-md border border-board-fg/30 px-4 text-board-fg ${
          busy ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        {label}
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-board-fg/25 bg-board-bg p-1">
        {CLOSE_REASONS.map((r) => (
          <button
            key={r.reason}
            type="button"
            disabled={ctx.demo || busy}
            onClick={(e) => {
              const d = e.currentTarget.closest('details');
              if (d) d.open = false;
              void ctx.run<CloseResponse>(key, `/requests/${id}/close`, { reason: r.reason });
            }}
            className="block min-h-12 w-full rounded px-3 text-left text-base text-board-fg hover:bg-board-fg/10 disabled:opacity-50"
          >
            {r.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function RequestRow({ r, ctx, highlight }: { r: BoardRequest; ctx: Ctx; highlight: boolean }) {
  const pickKey = `pickup:${r.id}`;
  const err = ctx.errors[`close:${r.id}`] ?? ctx.errors[pickKey];
  return (
    <li
      className={`rounded-lg border p-4 transition-[outline-color] ${
        highlight ? 'border-transparent outline outline-2 outline-accent' : 'border-board-fg/15'
      }`}
    >
      <p lang="hi" className="text-xl leading-snug text-board-fg">
        &ldquo;{r.source_text}&rdquo;
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.hard_constraints.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
        {r.max_budget !== null && <Chip>under {formatINR(r.max_budget)}</Chip>}
        {r.needed_by !== null && <Chip>{r.needed_by_label ?? formatDeadline(r.needed_by, ctx.today)}</Chip>}
        <StatusPill status={r.status} />
        <span className="label-mono text-board-fg/70">{ctx.demo ? 'Contact hidden in demo' : r.phone_masked ?? 'no consent'}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.status === 'reserved' && (
          <button
            type="button"
            disabled={ctx.demo || ctx.busy.has(pickKey)}
            onClick={() => void ctx.run<PickupResponse>(pickKey, `/requests/${r.id}/pickup`, {})}
            className="min-h-12 rounded-md bg-board-fg px-5 text-base font-semibold text-board-bg disabled:opacity-50"
          >
            Picked up
          </button>
        )}
        <CloseMenu id={r.id} ctx={ctx} />
        {err && <span className="label-mono text-board-error">{err}</span>}
      </div>
    </li>
  );
}
