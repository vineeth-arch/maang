'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeWav } from '@/components/customer/wav';
import type { TelemetryBody } from '@/lib/api-types';

const MAX_MS = 15000;
const MIN_MS = 500;
const WATCHDOG_MS = 1000;
const SILENCE_PEAK = 1e-4;

export type RecorderErrorKind = 'unsupported' | 'denied' | 'no_audio' | 'too_short' | 'failed';

/** Diagnostics for telemetry: audio context state, buffers received and recording length. No audio. */
export type RecorderInfo = Pick<TelemetryBody, 'ctx_state' | 'chunks' | 'duration_ms'>;

type Props = {
  onRecorded: (blob: Blob, durationMs: number, info?: RecorderInfo) => void;
  onError: (kind: RecorderErrorKind, info?: RecorderInfo) => void;
  disabled?: boolean;
};

function ctxStateOf(ctx: AudioContext | null): RecorderInfo['ctx_state'] {
  if (!ctx) return 'none';
  if (ctx.state === 'running' || ctx.state === 'closed') return ctx.state;
  return 'suspended'; // includes WebKit's 'interrupted'
}

function mkInfo(ctx_state: RecorderInfo['ctx_state'], chunks: number, ms: number): RecorderInfo {
  return { ctx_state, chunks: Math.min(chunks, 10000), duration_ms: Math.max(0, Math.min(Math.round(ms), 20000)) };
}

type AC = typeof AudioContext;

export default function VoiceRecorder({ onRecorded, onError, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const startedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peakRef = useRef(0);
  const activeRef = useRef(false);
  const startingRef = useRef(false);

  const teardown = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    if (watchRef.current) clearTimeout(watchRef.current);
    watchRef.current = null;
    try {
      procRef.current?.disconnect();
      srcRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    if (procRef.current) procRef.current.onaudioprocess = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
    procRef.current = null;
    srcRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const finish = useCallback(
    (deliver: boolean) => {
      if (!activeRef.current) return;
      activeRef.current = false;
      const rate = ctxRef.current?.sampleRate ?? 48000;
      const state = ctxStateOf(ctxRef.current);
      const duration = Math.min(Date.now() - startedRef.current, MAX_MS);
      const chunks = chunksRef.current;
      const peak = peakRef.current;
      chunksRef.current = [];
      const info = mkInfo(state, chunks.length, duration);
      teardown();
      setRecording(false);
      setElapsed(0);
      if (!deliver) return;
      // A quick double-tap lands here: nothing is uploaded and the mic is already torn down, so the next tap works.
      if (duration < MIN_MS) {
        onError('too_short', info);
        return;
      }
      try {
        const total = chunks.reduce((n, c) => n + c.length, 0);
        if (total === 0 || peak < SILENCE_PEAK) {
          onError('no_audio', info);
          return;
        }
        const all = new Float32Array(total);
        let off = 0;
        for (const c of chunks) {
          all.set(c, off);
          off += c.length;
        }
        const blob = new Blob([encodeWav(all, rate)], { type: 'audio/wav' });
        if (process.env.NODE_ENV !== 'production') {
          console.log('[VoiceRecorder] blob bytes', blob.size, 'duration ms', duration);
        }
        onRecorded(blob, duration, info);
      } catch {
        onError('failed', info);
      }
    },
    [onError, onRecorded, teardown],
  );

  const start = useCallback(async () => {
    if (startingRef.current || activeRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onError('unsupported', mkInfo('none', 0, 0));
      return;
    }
    const Ctor: AC | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
    if (!Ctor) {
      onError('unsupported', mkInfo('none', 0, 0));
      return;
    }
    startingRef.current = true;
    // Create inside the tap handler (iOS requires a user gesture).
    let ctx: AudioContext;
    let resumed: Promise<unknown>;
    try {
      ctx = new Ctor();
      // Must run synchronously in the tap, before any await: iOS only unlocks audio inside the user gesture.
      // Old WebKit may return undefined instead of a promise.
      resumed = Promise.resolve(ctx.resume()).catch(() => undefined);
    } catch {
      startingRef.current = false;
      onError('unsupported', mkInfo('none', 0, 0));
      return;
    }
    ctxRef.current = ctx;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      await resumed;
      if (ctx.state !== 'running') {
        const info = mkInfo(ctxStateOf(ctx), 0, 0);
        teardown();
        onError('no_audio', info);
        return;
      }
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      chunksRef.current = [];
      peakRef.current = 0;
      // ponytail: ScriptProcessor is deprecated but iOS supports it; move to AudioWorklet later.
      proc.onaudioprocess = (e) => {
        if (!activeRef.current) return;
        const data = new Float32Array(e.inputBuffer.getChannelData(0));
        let peak = peakRef.current;
        for (let i = 0; i < data.length; i++) {
          const a = Math.abs(data[i]);
          if (a > peak) peak = a;
        }
        peakRef.current = peak;
        chunksRef.current.push(data);
      };
      src.connect(proc);
      proc.connect(ctx.destination);
      srcRef.current = src;
      procRef.current = proc;
      activeRef.current = true;
      startedRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      // iOS can deliver no buffers, or only silent ones. Bail out early instead of uploading nothing.
      watchRef.current = setTimeout(() => {
        if (chunksRef.current.length === 0 || peakRef.current < SILENCE_PEAK) {
          const info = mkInfo(ctxStateOf(ctxRef.current), chunksRef.current.length, Date.now() - startedRef.current);
          finish(false);
          onError('no_audio', info);
        }
      }, WATCHDOG_MS);
      tickRef.current = setInterval(() => {
        const ms = Date.now() - startedRef.current;
        setElapsed(Math.min(ms, MAX_MS));
        if (ms >= MAX_MS) finish(true);
      }, 100);
    } catch (err) {
      const info = mkInfo(ctxStateOf(ctxRef.current), chunksRef.current.length, 0);
      teardown();
      const name = err instanceof DOMException ? err.name : '';
      onError(
        name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError' ? 'denied' : 'failed',
        info,
      );
    } finally {
      startingRef.current = false;
    }
  }, [finish, onError, teardown]);

  useEffect(
    () => () => {
      activeRef.current = false;
      teardown();
    },
    [teardown],
  );

  const secondsLeft = Math.max(0, Math.ceil((MAX_MS - elapsed) / 1000));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {recording && (
          <span
            aria-hidden
            className="mic-pulse absolute inset-0 rounded-full border-2 border-accent"
          />
        )}
        <button
          type="button"
          onClick={() => (recording ? finish(true) : void start())}
          disabled={disabled}
          aria-label={recording ? 'Recording rokein' : 'Bolna shuru karein'}
          className={`relative flex h-36 w-36 items-center justify-center rounded-full text-white transition-transform active:scale-[0.97] disabled:opacity-50 ${
            recording ? 'bg-ink' : 'bg-accent'
          }`}
        >
          {recording ? (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          ) : (
            <svg width="52" height="52" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
              <path d="M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48Zm72-48a8 8 0 0 0-16 0 56 56 0 0 1-112 0 8 8 0 0 0-16 0 72.11 72.11 0 0 0 64 71.55V232a8 8 0 0 0 16 0v-32.45A72.11 72.11 0 0 0 200 128Z" />
            </svg>
          )}
        </button>
      </div>
      <p className="min-h-6 text-center text-[16px] text-muted" aria-live="polite">
        {recording ? `Sun raha hoon  ·  ${secondsLeft}s baaki  ·  rokne ke liye tap` : 'Tap karke bolein'}
      </p>
      <style>{`
        @keyframes mic-pulse { 0% { transform: scale(0.9); opacity: 0.9; } 100% { transform: scale(1.18); opacity: 0; } }
        .mic-pulse { animation: mic-pulse 1.4s ease-out infinite; }
      `}</style>
    </div>
  );
}
