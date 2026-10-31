'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardRequest, BoardResponse, CloseResponse } from '@/lib/api-types';
import { formatDeadline, formatINR } from '@/lib/domain';
import { api, ApiFail, type Ctx } from './api';
import { ClusterCard } from './ClusterCard';
import { CloseMenu, RequestRow } from './RequestRow';
import { StockSheet } from './StockSheet';

type Conn = 'loading' | 'ok' | 'offline' | 'unauthorized';

function allIds(d: BoardResponse): string[] {
  const ids: string[] = [];
  for (const c of d.clusters) for (const r of c.requests) ids.push(r.id);
  for (const u of d.urgent) ids.push(u.id);
  for (const u of d.unclustered) ids.push(u.id);
  return ids;
}

function Lane({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="font-display text-3xl font-semibold text-[#EEEAE0]">{title}</h2>
      {hint && <p className="label-mono mt-1 text-[#EEEAE0]/60">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-[#EEEAE0]/20 p-5 text-lg text-[#EEEAE0]/60">{children}</p>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#EEEAE0]/15 p-5">
      <p className="label-mono text-[#EEEAE0]/70">{label}</p>
      <p className="font-display mt-1 text-7xl font-bold leading-none text-[#EEEAE0]">{value}</p>
    </div>
  );
}

export function Board({ shop, k }: { shop: string; k: string }) {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [conn, setConn] = useState<Conn>(k ? 'loading' : 'unauthorized');
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [origin, setOrigin] = useState('');

  const seen = useRef<Set<string> | null>(null);
  const timers = useRef<number[]>([]);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const refresh = useCallback(async () => {
    if (!k) return;
    try {
      const d = await api<BoardResponse>(`/api/merchant/${encodeURIComponent(shop)}/board`, k);
      setData(d);
      setConn('ok');
      const ids = allIds(d);
      if (seen.current === null) {
        seen.current = new Set(ids);
      } else {
        const fresh = ids.filter((id) => !seen.current!.has(id));
        for (const id of ids) seen.current.add(id);
        if (fresh.length > 0) {
          setNewIds((prev) => new Set([...prev, ...fresh]));
          const t = window.setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev);
              for (const id of fresh) next.delete(id);
              return next;
            });
          }, 4000);
          timers.current.push(t);
        }
      }
    } catch (e) {
      if (e instanceof ApiFail && e.status === 401) setConn('unauthorized');
      else setConn((c) => (c === 'unauthorized' ? c : 'offline'));
    }
  }, [k, shop]);

  useEffect(() => {
    if (!k) return;
    let stopped = false;
    let timer: number | undefined;
    const loop = async () => {
      if (stopped) return;
      if (!document.hidden) await refresh();
      if (!stopped) timer = window.setTimeout(() => void loop(), 3000);
    };
    void loop();
    const onVis = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    const pending = timers.current;
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, [k, refresh]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 5000);
  }, []);

  const run = useCallback(
    async <T,>(key: string, suffix: string, body: unknown): Promise<T | null> => {
      setBusy((b) => new Set(b).add(key));
      setErrors((e) => {
        const { [key]: _drop, ...rest } = e;
        void _drop;
        return rest;
      });
      try {
        const res = await api<T>(`/api/merchant/${encodeURIComponent(shop)}${suffix}`, k, body);
        await refresh();
        return res;
      } catch (e) {
        const code = e instanceof ApiFail ? e.code : 'network_error';
        setErrors((er) => ({ ...er, [key]: code }));
        return null;
      } finally {
        setBusy((b) => {
          const next = new Set(b);
          next.delete(key);
          return next;
        });
      }
    },
    [k, shop, refresh],
  );

  if (conn === 'unauthorized') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#17130F] p-8">
        <p className="font-display text-center text-5xl font-semibold text-[#EEEAE0]">
          Merchant key missing or wrong.
        </p>
      </main>
    );
  }

  const today = data?.today ?? '';
  const ctx: Ctx = { shop, today, busy, errors, run, toast };

  const matched = data ? data.clusters.filter((c) => c.eligible.length > 0) : [];
  const unmatched = data ? data.clusters.filter((c) => c.eligible.length === 0) : [];
  const sheetCluster = data && sheetKey ? (data.clusters.find((c) => c.key === sheetKey) ?? null) : null;
  const m = data?.metrics;

  return (
    <main className="min-h-screen bg-[#17130F] px-5 py-6 text-[#EEEAE0] sm:px-8 xl:px-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-mono text-[#EEEAE0]/70">02 / BOARD</p>
          <h1 className="font-display mt-1 text-5xl font-bold leading-none sm:text-6xl">
            {data?.shop.name ?? shop}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {conn === 'offline' && (
            <span className="label-mono rounded-md border border-[#EEEAE0]/30 px-3 py-2 text-[#EEEAE0]">
              offline, retrying
            </span>
          )}
          <span className="label-mono rounded-md border border-[#EEEAE0]/20 px-3 py-2 text-[#EEEAE0]/70">
            Demo data: synthetic
          </span>
          <button
            type="button"
            aria-expanded={showQr}
            onClick={() => setShowQr((s) => !s)}
            className="label-mono min-h-12 rounded-md border border-[#EEEAE0]/40 px-4 text-[#EEEAE0]"
          >
            Counter QR
          </button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Counter label="Maange gaye" value={m?.captured ?? 0} />
        <Counter label="Bataya" value={m?.notified ?? 0} />
        <Counter label="Reserve" value={m?.reserved ?? 0} />
        <Counter label="Le gaye" value={m?.picked_up ?? 0} />
      </div>

      <div className={`mt-8 grid gap-8 ${showQr ? 'xl:grid-cols-[1fr_22rem]' : ''}`}>
        <div className="min-w-0">
          {!data ? (
            <p className="label-mono text-[#EEEAE0]/70">Loading…</p>
          ) : (
            <div className="grid gap-8 xl:grid-cols-3">
              <Lane title="Abhi chahiye" hint="Urgent requests">
                {data.urgent.length === 0 && <Empty>Koi urgent request nahi.</Empty>}
                {data.urgent.map((u) => {
                  const key = `close:${u.id}`;
                  return (
                    <article
                      key={u.id}
                      className={`rounded-xl border-l-8 border-[#B42318] bg-[#EEEAE0]/[0.03] p-5 ${
                        newIds.has(u.id) ? 'outline outline-2 outline-[#FF0A6C]' : ''
                      }`}
                    >
                      <p lang="hi" className="text-2xl leading-snug">
                        &ldquo;{u.source_text}&rdquo;
                      </p>
                      <p className="label-mono mt-2 text-[#EEEAE0]/80">
                        {u.needed_by_label ?? formatDeadline(u.needed_by, today)}
                      </p>
                      {u.alternatives.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {u.alternatives.map((p) => (
                            <li key={p.id} className="text-base text-[#EEEAE0]/80">
                              In stock: {p.name} {formatINR(p.price)} (info only)
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busy.has(key)}
                          onClick={() =>
                            void run<CloseResponse>(key, `/requests/${u.id}/close`, {
                              reason: 'cannot_meet_deadline',
                            })
                          }
                          className="min-h-12 rounded-md border border-[#EEEAE0] px-5 text-lg font-semibold disabled:opacity-50"
                        >
                          Nahi ho paayega
                        </button>
                        {errors[key] && <span className="label-mono text-[#FF8A7A]">{errors[key]}</span>}
                      </div>
                    </article>
                  );
                })}
              </Lane>

              <Lane title="Stock mangwao" hint="Clusters you can serve">
                {matched.length === 0 && <Empty>Abhi koi cluster nahi.</Empty>}
                {matched.map((c) => (
                  <ClusterCard key={c.key} cluster={c} ctx={ctx} newIds={newIds} noMatch={false} onStock={setSheetKey} />
                ))}
              </Lane>

              <Lane title="No match" hint="Not in your catalogue">
                {unmatched.length === 0 && <Empty>Sab kuch catalogue mein hai.</Empty>}
                {unmatched.map((c) => (
                  <ClusterCard key={c.key} cluster={c} ctx={ctx} newIds={newIds} noMatch onStock={setSheetKey} />
                ))}
              </Lane>
            </div>
          )}

          {data && data.unclustered.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-3xl font-semibold">Samajh nahi aaya</h2>
              <ul className="mt-4 grid gap-3 xl:grid-cols-2">
                {data.unclustered.map((r: BoardRequest) => (
                  <li
                    key={r.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EEEAE0]/15 p-4 ${
                      newIds.has(r.id) ? 'outline outline-2 outline-[#FF0A6C]' : ''
                    }`}
                  >
                    <p lang="hi" className="min-w-0 flex-1 text-lg">
                      &ldquo;{r.source_text}&rdquo;
                    </p>
                    <CloseMenu id={r.id} ctx={ctx} />
                    {errors[`close:${r.id}`] && (
                      <span className="label-mono w-full text-[#FF8A7A]">{errors[`close:${r.id}`]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10 max-w-2xl rounded-xl border border-dashed border-[#EEEAE0]/30 p-5">
            <p className="label-mono text-[#EEEAE0]/70">Concept (not live)</p>
            <p className="mt-2 text-lg text-[#EEEAE0]/90">
              Demand-backed stock advance. Reservations on one item can signal a small stock loan through
              Paytm&apos;s lending partners.
            </p>
          </section>

          {data && data.expired.length > 0 && (
            <details className="mt-10 opacity-60">
              <summary className="label-mono min-h-12 cursor-pointer py-3 text-[#EEEAE0]">
                Expired ({data.expired.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {data.expired.map((r) => (
                  <li key={r.id} className="rounded-lg border border-[#EEEAE0]/10 p-3 text-base">
                    <span className="label-mono mr-3">Expired</span>
                    <span lang="hi">&ldquo;{r.source_text}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {showQr && (
          <aside className="h-fit rounded-xl border border-[#EEEAE0]/15 p-5">
            <p className="label-mono text-[#EEEAE0]/70">Counter QR</p>
            <div className="mt-3 rounded-lg bg-[#EEEAE0] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/m/${encodeURIComponent(shop)}/qr.svg`}
                alt="QR code for the customer page"
                className="block h-auto w-full"
              />
            </div>
            <p className="label-mono mt-3 break-all text-[#EEEAE0]">{`${origin}/s/${shop}`}</p>
          </aside>
        )}
      </div>

      {sheetCluster && <StockSheet key={sheetCluster.key} cluster={sheetCluster} ctx={ctx} onClose={() => setSheetKey(null)} />}

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg border border-[#EEEAE0]/30 bg-[#EEEAE0] px-6 py-4 text-xl font-semibold text-[#17130F]"
        >
          {toastMsg}
        </div>
      )}
    </main>
  );
}
