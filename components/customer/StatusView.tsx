'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CancelResponse, CloseReason, CustomerView, ReserveResponse } from '@/lib/api-types';
import { formatINR } from '@/lib/domain';

const CLOSE_TEXT: Record<CloseReason, string> = {
  cannot_meet_deadline: 'Dukaan is time tak nahi de paayegi',
  no_longer_needed: 'Aapne request band kar di',
  not_stockable: 'Dukaan ye cheez nahi rakhti',
  duplicate: 'Ye request pehle se thi',
};

const btnDark =
  'min-h-12 rounded-md bg-primary px-6 text-[16px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50';
const btnLine =
  'min-h-12 rounded-md border border-line px-6 text-[16px] transition-transform active:scale-[0.98] disabled:opacity-50';

type Tone = 'ok' | 'warn' | 'danger' | 'muted';
const BAND: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', muted: 'bg-muted' };

function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white/50">
      <div aria-hidden className={`h-2 ${BAND[tone]}`} />
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function StatusView({ id, t }: { id: string; t: string }) {
  const [view, setView] = useState<CustomerView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const doneRef = useRef(false);

  const url = `/api/requests/${encodeURIComponent(id)}?t=${encodeURIComponent(t)}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 404) {
        doneRef.current = true;
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as CustomerView;
      setView(data);
      if (data.expired || data.status === 'picked_up' || data.status === 'closed') doneRef.current = true;
    } catch {
      /* keep last view; next tick retries */
    }
  }, [url]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || doneRef.current) return;
      if (!document.hidden) await load();
      if (!cancelled && !doneRef.current) timer = setTimeout(tick, 3000);
    };
    const onVisible = () => {
      if (!document.hidden && !doneRef.current) {
        if (timer) clearTimeout(timer);
        void tick();
      }
    };
    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const act = async (path: 'reserve' | 'cancel') => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(id)}/${path}?t=${encodeURIComponent(t)}`, { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ReserveResponse | CancelResponse;
      if (path === 'reserve' && (data as ReserveResponse).result === 'out_of_stock') {
        setMessage('Abhi ke liye stock khatam. Dukaan ko bata diya hai.');
      }
      doneRef.current = false;
      await load();
    } catch {
      setMessage('Kuch gadbad hui. Phir se try karein.');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  let body: React.ReactNode;
  if (notFound) {
    body = (
      <Status tone="danger">
        <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1]">Ye link sahi nahi hai.</h1>
      </Status>
    );
  } else if (!view) {
    body = <p className="text-[17px] text-muted">Dekh rahe hain…</p>;
  } else {
    const asked = view.item_label || view.source_text;
    const askedBlock = (
      <div className="mt-8 border-t border-line pt-5">
        <p className="label-mono text-muted">Aapne maanga</p>
        <p className="mt-2 text-[17px] leading-relaxed">{asked}</p>
      </div>
    );
    const cancelBlock = (label: string) =>
      confirming ? (
        <div className="mt-8 flex flex-col gap-3">
          <p className="text-[16px]">Pakka? Ye request band ho jaayegi.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={btnDark} disabled={busy} onClick={() => void act('cancel')}>
              {busy ? 'Ruko…' : 'Haan, band karo'}
            </button>
            <button type="button" className={btnLine} disabled={busy} onClick={() => setConfirming(false)}>
              Nahi
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={`${btnLine} mt-8`} onClick={() => setConfirming(true)}>
          {label}
        </button>
      );

    if (view.expired) {
      body = (
        <>
          <Status tone="warn">
            <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1]">Ye request expire ho gayi</h1>
          </Status>
          {askedBlock}
        </>
      );
    } else if (view.status === 'open') {
      body = (
        <>
          <Status tone="muted">
            <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1]">Dukaan ko bata diya ✓</h1>
            <p className="mt-3 text-[17px] text-muted">{view.shop_name} ko pata hai. Stock aate hi aapko khabar milegi.</p>
          </Status>
          {askedBlock}
          {cancelBlock('No longer needed')}
        </>
      );
    } else if (view.status === 'notified') {
      body = (
        <>
          <Status tone="ok">
            <h1 className="font-display text-[3rem] font-semibold leading-[1.05] text-accent">Stock aa gaya!</h1>
            {view.product && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[19px] font-medium">{view.product.name}</p>
                <p className="mt-1 text-[17px] text-muted">{formatINR(view.product.price)}</p>
              </div>
            )}
          </Status>
          <button type="button" className={`${btnDark} mt-6 w-full`} disabled={busy} onClick={() => void act('reserve')}>
            {busy ? 'Ruko…' : 'Reserve karein'}
          </button>
          {message && (
            <p className="mt-4 rounded-lg border border-warn/50 bg-warn/10 px-4 py-3 text-[16px] leading-snug" role="status">
              {message}
            </p>
          )}
          {askedBlock}
        </>
      );
    } else if (view.status === 'reserved') {
      body = (
        <>
          <Status tone="ok">
            <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1]">Aapke liye rakha hai.</h1>
            <p className="mt-3 text-[17px] text-muted">Dukaan par aake le jaayein.</p>
            {view.product && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[19px] font-medium">{view.product.name}</p>
                <p className="mt-1 text-[17px] text-muted">{formatINR(view.product.price)}</p>
              </div>
            )}
          </Status>
          {cancelBlock('Ab nahi chahiye')}
        </>
      );
    } else if (view.status === 'picked_up') {
      body = (
        <Status tone="ok">
          <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1]">Le gaye. Shukriya!</h1>
        </Status>
      );
    } else {
      body = (
        <>
          <Status tone="muted">
            <h1 className="font-display text-[2.2rem] font-semibold leading-[1.1]">
              {view.close_reason ? CLOSE_TEXT[view.close_reason] : 'Ye request band ho gayi'}
            </h1>
          </Status>
          {askedBlock}
        </>
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-12 pt-6">
      <header className="flex items-start justify-between gap-3">
        <p className="truncate text-[15px] font-medium">{view?.shop_name ?? ' '}</p>
        <span className="label-mono pt-1 text-muted">MAANG</span>
      </header>
      <section className="mt-14" aria-live="polite">
        {body}
      </section>
      <footer className="mt-auto pt-12 text-[14px] text-muted">Aapka number sirf is request ke liye hai.</footer>
    </main>
  );
}
