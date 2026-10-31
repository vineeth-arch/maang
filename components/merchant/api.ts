import type { ApiError } from '@/lib/api-types';

export class ApiFail extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

// The merchant key travels in the x-merchant-key header only: never in the URL, never stored here or logged.
// Demo paths (/api/demo/) are public and never carry a key.
export async function api<T>(path: string, k: string, body?: unknown): Promise<T> {
  const demo = path.startsWith('/api/demo/');
  if (demo && body !== undefined) throw new ApiFail(403, 'demo_read_only');
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (!demo) headers['x-merchant-key'] = k;
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const j = (await res.json()) as Partial<ApiError>;
      if (j && typeof j.code === 'string') code = j.code;
    } catch {
      // keep fallback code
    }
    throw new ApiFail(res.status, code);
  }
  return (await res.json()) as T;
}

export type Ctx = {
  demo?: boolean;
  shop: string;
  today: string;
  busy: ReadonlySet<string>;
  errors: Readonly<Record<string, string>>;
  // POSTs to /api/merchant/[shop]<suffix>; returns null on failure (error stored under key).
  run: <T>(key: string, suffix: string, body: unknown) => Promise<T | null>;
  toast: (msg: string) => void;
  // Soundbox only: speaks after a successful notify. Absent when the flag is off.
  announce?: (count: number) => void;
};
