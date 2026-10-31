'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExtractedRequest, RelativeDeadline } from '@/lib/contracts';
import type { ApiError, CreateRequestBody, CreateRequestResponse, InputMode, TranscribeResponse } from '@/lib/api-types';
import { formatDeadline, formatINR, resolveRelative, todayIST } from '@/lib/domain';
import VoiceRecorder, { type RecorderErrorKind } from '@/components/VoiceRecorder';
import { voiceErrorLine, type VoiceErrorKind } from '@/components/customer/voice-errors';

type Stage = 'capture' | 'review';
type Tag = 'rules' | 'ai' | 'basic' | null;
type Edits = { item?: string; max_budget?: number | null; needed_by?: string | null };

const BUDGETS: Array<{ label: string; value: number | null }> = [
  { label: '₹500', value: 500 },
  { label: '₹1,000', value: 1000 },
  { label: '₹2,000', value: 2000 },
  { label: 'Koi bhi', value: null },
];
const DEADLINES: Array<{ label: string; value: RelativeDeadline }> = [
  { label: 'Aaj', value: 'today' },
  { label: 'Kal', value: 'tomorrow' },
  { label: 'Is hafte', value: 'this_week' },
  { label: 'Jaldi nahi', value: 'none' },
];

const chipBase =
  'inline-flex min-h-12 items-center rounded-md border px-4 text-[15px] leading-tight transition-transform active:scale-[0.98]';
const fieldBase =
  'w-full rounded-md border border-line text-[17px] focus:border-ink focus-visible:outline-2 focus-visible:outline-offset-2';
const noticeBox = 'rounded-lg border border-warn/50 bg-warn/10 px-4 py-3 text-[16px] leading-snug text-ink';
const chipIdle = `${chipBase} border-line bg-white/50 text-ink`;
const chipOn = `${chipBase} border-ink bg-ink text-white`;

const storeKey = (slug: string) => `maang.capture.${slug}`;

// Errors whose message sends the customer to the text box get focus there; the rest ask for another try at the mic.
const FOCUS_TEXT: ReadonlySet<VoiceErrorKind> = new Set(['unsupported', 'in_app', 'denied', 'server', 'failed']);

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

function blankExtraction(text: string): ExtractedRequest {
  return {
    item: null,
    item_key: null,
    hard_constraints: [],
    soft_preferences: [],
    max_budget: null,
    quantity: null,
    needed_by: null,
    needed_by_label: null,
    urgent: false,
    language: 'hi-IN',
    missing: ['item', 'max_budget', 'needed_by'],
    clarifying_question: null,
    source_text: text,
    mode: 'rules_fallback',
  };
}

export default function CaptureFlow({
  shopSlug,
  shopName,
  subtitle,
  example,
}: {
  shopSlug: string;
  shopName: string;
  subtitle?: string;
  example?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('capture');
  const [text, setText] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('typed');
  const [notice, setNotice] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const [result, setResult] = useState<ExtractedRequest | null>(null);
  const [tag, setTag] = useState<Tag>(null);
  const [extractFailed, setExtractFailed] = useState(false);
  const [edits, setEdits] = useState<Edits>({});
  const [answers, setAnswers] = useState<{ max_budget?: number | null; needed_by?: RelativeDeadline }>({});
  const [open, setOpen] = useState<'budget' | 'deadline' | null>(null);

  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const typedRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef('');
  const seqRef = useRef(0);
  const firstRunRef = useRef(true);
  const today = useMemo(() => todayIST(), []);

  // Restore saved transcript.
  // Applied in a microtask so the first render still matches the server HTML.
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        const raw = sessionStorage.getItem(storeKey(shopSlug));
        if (raw) {
          const saved = JSON.parse(raw) as { text?: string; mode?: InputMode };
          if (saved.text && saved.text.trim()) {
            setText(saved.text);
            setInputMode(saved.mode === 'voice' ? 'voice' : 'typed');
            setStage('review');
          }
        }
      } catch {
        /* storage unavailable */
      }
    });
    return () => {
      live = false;
    };
  }, [shopSlug]);

  // Mirror transcript.
  useEffect(() => {
    try {
      if (text.trim()) sessionStorage.setItem(storeKey(shopSlug), JSON.stringify({ text, mode: inputMode }));
    } catch {
      /* ignore */
    }
  }, [text, inputMode, shopSlug]);

  // Extraction: rules at once, ai when it returns. Debounced on edits.
  useEffect(() => {
    if (stage !== 'review' || !text.trim()) return;
    const delay = firstRunRef.current ? 0 : 600;
    firstRunRef.current = false;
    const seq = ++seqRef.current;
    const handle = setTimeout(() => {
      setExtractFailed(false);
      const body = (mode: 'rules' | 'ai') => ({ shopSlug, text, mode });
      postJson<ExtractedRequest>('/api/capture/extract', body('rules'))
        .then((r) => {
          if (seq !== seqRef.current) return;
          if (r.ok && r.data) {
            setResult((prev) => (prev && prev.mode === 'ai' && prev.source_text === text ? prev : r.data));
            setTag((t) => (t === 'ai' ? t : 'basic'));
          } else {
            setExtractFailed(true);
          }
        })
        .catch(() => {
          if (seq === seqRef.current) setExtractFailed(true);
        });
      postJson<ExtractedRequest>('/api/capture/extract', body('ai'))
        .then((r) => {
          if (seq !== seqRef.current || !r.ok || !r.data) return;
          setResult(r.data);
          setExtractFailed(false);
          setTag(r.data.mode === 'ai' ? 'ai' : 'basic');
        })
        .catch(() => undefined);
    }, delay);
    return () => clearTimeout(handle);
  }, [text, stage, shopSlug]);

  const goReview = useCallback((t: string, mode: InputMode) => {
    firstRunRef.current = true;
    setResult(null);
    setTag(null);
    setEdits({});
    setAnswers({});
    setOpen(null);
    setText(t);
    setInputMode(mode);
    setStage('review');
  }, []);

  const showVoiceError = useCallback((kind: VoiceErrorKind) => {
    setNotice(voiceErrorLine(kind));
    if (FOCUS_TEXT.has(kind)) typedRef.current?.focus();
  }, []);

  const onRecordError = useCallback(
    (kind: RecorderErrorKind) => {
      showVoiceError(kind);
    },
    [showVoiceError],
  );

  const onRecorded = useCallback(
    async (blob: Blob) => {
      setTranscribing(true);
      setNotice(null);
      let kind: VoiceErrorKind = 'server';
      try {
        const form = new FormData();
        form.append('audio', blob, 'capture.wav');
        const res = await fetch('/api/capture/transcribe', { method: 'POST', body: form });
        if (res.ok) {
          const data = (await res.json()) as TranscribeResponse;
          if (data.text && data.text.trim()) {
            goReview(data.text.trim(), 'voice');
            return;
          }
          kind = 'empty';
        } else if (res.status === 422) {
          const err = (await res.json().catch(() => null)) as ApiError | null;
          kind = err?.code === 'too_short' ? 'too_short' : err?.code === 'empty_transcript' ? 'empty' : 'server';
        }
      } catch {
        kind = 'server';
      } finally {
        setTranscribing(false);
      }
      showVoiceError(kind);
    },
    [showVoiceError, goReview],
  );

  // Effective values: AI result underneath, user edits on top (touched fields never overwritten).
  const eff = useMemo(() => {
    const base = result ?? blankExtraction(text);
    const item = 'item' in edits ? (edits.item ?? '').trim() || null : base.item;
    const max_budget = 'max_budget' in edits ? (edits.max_budget ?? null) : base.max_budget;
    const needed_by = 'needed_by' in edits ? (edits.needed_by ?? null) : base.needed_by;
    const needBudget = base.missing.includes('max_budget') && !('max_budget' in edits);
    const needDeadline = base.missing.includes('needed_by') && !('needed_by' in edits);
    return { base, item, max_budget, needed_by, needBudget, needDeadline };
  }, [result, edits, text]);

  const showQuestion = !!result?.clarifying_question && (eff.needBudget || eff.needDeadline);

  const pickBudget = (v: number | null) => {
    setEdits((e) => ({ ...e, max_budget: v }));
    setAnswers((a) => ({ ...a, max_budget: v }));
    setOpen(null);
  };
  const pickDeadline = (v: RelativeDeadline) => {
    const resolved = (resolveRelative(v, today) as string | null | undefined) ?? null;
    setEdits((e) => ({ ...e, needed_by: resolved }));
    setAnswers((a) => ({ ...a, needed_by: v }));
    setOpen(null);
  };

  const digits = phone.replace(/\D/g, '').slice(0, 10);
  const phoneEntered = digits.length > 0;
  const phoneOk = digits.length === 10;

  const submit = async () => {
    if (submitting) return;
    if (consent && !phoneOk) {
      setSubmitError('Stock aane par batane ke liye 10 digit ka number daalein.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const extracted: ExtractedRequest = {
      ...eff.base,
      item: eff.item,
      item_key: eff.item === (eff.base.item ?? null) || (eff.item ?? '') === (eff.base.item ?? '').trim() ? eff.base.item_key : null,
      max_budget: eff.max_budget,
      needed_by: eff.needed_by,
      source_text: text,
    };
    const body: CreateRequestBody = {
      shopSlug,
      source_text: text,
      input_mode: inputMode,
      extracted,
      answers: Object.keys(answers).length ? answers : undefined,
      consent,
      ...(consent && phoneOk ? { phone: digits } : {}),
    };
    try {
      const r = await postJson<CreateRequestResponse>('/api/requests', body);
      if (r.status === 201 && r.data) {
        try {
          sessionStorage.removeItem(storeKey(shopSlug));
        } catch {
          /* ignore */
        }
        router.push(`/r/${r.data.id}?t=${encodeURIComponent(r.data.token)}`);
        return;
      }
      setSubmitError(r.status === 429 ? 'Thodi der baad try karein.' : 'Bhej nahi paaye. Aapka likha hua safe hai, phir se try karein.');
    } catch {
      setSubmitError('Bhej nahi paaye. Aapka likha hua safe hai, phir se try karein.');
    }
    setSubmitting(false);
  };

  const startOver = () => {
    seqRef.current++;
    setStage('capture');
    setNotice(null);
    draftRef.current = '';
    try {
      sessionStorage.removeItem(storeKey(shopSlug));
    } catch {
      /* ignore */
    }
    setText('');
    setResult(null);
    setEdits({});
    setAnswers({});
  };

  const budgetText = eff.max_budget != null ? `${formatINR(eff.max_budget)} ke andar` : null;
  const deadlineText = eff.needed_by ? formatDeadline(eff.needed_by, today) : null;
  const budgetAsked = 'max_budget' in edits || !eff.base.missing.includes('max_budget');
  const deadlineAsked = 'needed_by' in edits || !eff.base.missing.includes('needed_by');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-16 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{shopName}</p>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          <p className="mt-1 inline-block rounded-md border border-line px-2 py-0.5 text-[12px] text-muted">
            Demo shop: synthetic data
          </p>
        </div>
        <span className="label-mono pt-1 text-muted">MAANG</span>
      </header>

      {stage === 'capture' && (
        <section className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-[2.2rem] font-semibold leading-[1.05]">Nahi mila? Bolo, kya chahiye.</h1>

          <div className="mt-8 flex flex-col items-center">
            <VoiceRecorder onRecorded={onRecorded} onError={onRecordError} disabled={transcribing} />
            {transcribing && (
              <p className="mt-4 text-[15px] text-muted" aria-live="polite">
                Samajh rahe hain…
              </p>
            )}
          </div>

          <p className="mt-8 text-center text-[16px] leading-relaxed text-muted">
            Dukaan ko bata denge. Stock aaya toh aapko pata chalega.
          </p>

          {notice && (
            <p className={`mt-6 ${noticeBox}`} role="status">
              {notice}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <label htmlFor="typed" className="label-mono text-muted">
              Ya likh ke batayein
            </label>
            <textarea
              id="typed"
              ref={typedRef}
              defaultValue="" // draftRef is always '' when this mounts: startOver is the only way back and clears it
              onChange={(e) => (draftRef.current = e.target.value)}
              rows={4}
              placeholder={example ?? 'Remote wali gaadi, rechargeable, 1000 ke andar, kal tak'}
              className={`${fieldBase} resize-none bg-white/60 p-4 leading-relaxed`}
            />
            <button
              type="button"
              onClick={() => {
                const t = draftRef.current.trim();
                if (t) goReview(t, 'typed');
              }}
              className="min-h-12 rounded-md bg-primary px-6 text-[16px] font-medium text-white transition-transform active:scale-[0.98]"
            >
              Aage
            </button>
          </div>
        </section>
      )}

      {stage === 'review' && (
        <section className="mt-10 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <label htmlFor="transcript" className="label-mono text-muted">
              Aapne kaha
            </label>
            <textarea
              id="transcript"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className={`${fieldBase} resize-none bg-white/60 p-4 leading-relaxed`}
            />
            <button type="button" onClick={startOver} className="min-h-11 self-start px-1 text-[15px] text-muted underline underline-offset-4">
              Dobara bolein
            </button>
          </div>

          <div className="rounded-lg border border-line bg-white/50 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-semibold">Samjha?</h2>
              {tag === 'ai' && <span className="label-mono text-muted">AI se samjha</span>}
              {tag === 'basic' && <span className="label-mono text-muted">basic mode</span>}
            </div>

            {extractFailed && !result && (
              <p className="mt-3 text-[15px] text-muted">
                Abhi samajh nahi paaye. Neeche item likh dein, ya dobara try karein.
              </p>
            )}
            {!result && !extractFailed && <p className="mt-3 text-[15px] text-muted">Samajh rahe hain…</p>}

            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="label-mono text-muted">Item</span>
                <input
                  value={eff.item ?? ''}
                  onChange={(e) => setEdits((ed) => ({ ...ed, item: e.target.value }))}
                  placeholder="Kya chahiye"
                  className={`${fieldBase} min-h-12 bg-white/70 px-4`}
                />
              </label>

              {eff.base.hard_constraints.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {eff.base.hard_constraints.map((c) => (
                    <span key={c} className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-[15px]">
                      {c.replace(/_/g, ' ').replace(':', ': ')}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button type="button" className={open === 'budget' ? chipOn : chipIdle} onClick={() => setOpen(open === 'budget' ? null : 'budget')}>
                  {budgetText ?? (budgetAsked ? 'Budget: koi bhi' : 'Budget batayein')}
                </button>
                <button type="button" className={open === 'deadline' ? chipOn : chipIdle} onClick={() => setOpen(open === 'deadline' ? null : 'deadline')}>
                  {deadlineText && deadlineText !== '—' ? deadlineText : deadlineAsked ? 'Jaldi nahi' : 'Kab tak chahiye?'}
                </button>
              </div>

              {open === 'budget' && (
                <div className="flex flex-wrap gap-3">
                  {BUDGETS.map((b) => (
                    <button key={b.label} type="button" className={eff.max_budget === b.value && budgetAsked ? chipOn : chipIdle} onClick={() => pickBudget(b.value)}>
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
              {open === 'deadline' && (
                <div className="flex flex-wrap gap-3">
                  {DEADLINES.map((d) => (
                    <button key={d.value} type="button" className={answers.needed_by === d.value ? chipOn : chipIdle} onClick={() => pickDeadline(d.value)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              )}

              {answers.needed_by && answers.needed_by !== 'none' && eff.needed_by && (
                <p className="text-[15px] text-muted">Tareekh: {formatDeadline(eff.needed_by, today)}</p>
              )}
            </div>

            {showQuestion && open === null && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[17px] leading-snug">{result?.clarifying_question}</p>
                {eff.needBudget && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {BUDGETS.map((b) => (
                      <button key={b.label} type="button" className={chipIdle} onClick={() => pickBudget(b.value)}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
                {eff.needDeadline && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {DEADLINES.map((d) => (
                      <button key={d.value} type="button" className={chipIdle} onClick={() => pickDeadline(d.value)}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <label htmlFor="phone" className="label-mono text-muted">
              Number (sirf is cheez ke liye)
            </label>
            <input
              id="phone"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={14}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))}
              placeholder="10 digit number"
              className={`${fieldBase} min-h-12 bg-white/60 px-4`}
            />
            <label className="flex min-h-12 items-center gap-3 text-[16px]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="h-6 w-6 shrink-0 accent-ink"
              />
              Haan, stock aane par mujhe batana
            </label>
            {phoneEntered && !consent && (
              <p className="text-[15px] text-muted">Number tabhi save hoga jab aap haan kahenge.</p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {submitError && (
              <p className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-[16px] leading-snug text-ink" role="alert">
                {submitError}
              </p>
            )}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !text.trim()}
              className="min-h-14 rounded-md bg-primary px-6 text-[17px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? 'Bhej rahe hain…' : submitError ? 'Phir se bhejein' : 'Dukaan ko bhejo'}
            </button>
          </div>
        </section>
      )}

      <footer className="mt-auto pt-12 text-[13px] text-muted">Aapka number sirf is request ke liye hai.</footer>
    </main>
  );
}
