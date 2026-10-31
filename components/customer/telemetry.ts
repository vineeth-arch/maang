import type { TelemetryBody } from '@/lib/api-types';

/** Fire-and-forget capture diagnostics. Never throws, never blocks the customer. */
export function sendTelemetry(b: TelemetryBody): void {
  try {
    void fetch('/api/capture/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(b),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* telemetry must never break capture */
  }
}
