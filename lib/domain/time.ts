import type { RelativeDeadline } from '../contracts';
import { resolveDeadline } from '../voice-fallback';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const istFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayIST(now: Date = new Date()): string {
  return istFormatter.format(now);
}

function parseISO(iso: string): Date | null {
  if (!ISO_RE.test(iso)) return null;
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === iso ? d : null;
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function resolveRelative(rel: RelativeDeadline, todayISO: string): string | null {
  return resolveDeadline(rel, todayISO);
}

export function isValidFutureISO(iso: string, todayISO: string, maxDays = 365): boolean {
  if (parseISO(iso) === null) return false;
  return iso >= todayISO && iso <= addDaysISO(todayISO, maxDays);
}

export function formatDeadline(iso: string | null, todayISO: string): string {
  if (iso === null) return '—';
  const d = parseISO(iso);
  if (d === null) return '—';
  const short = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (iso === todayISO) return `Aaj, ${short}`;
  if (iso === addDaysISO(todayISO, 1)) return `Kal, ${short}`;
  return `${WEEKDAYS[d.getUTCDay()]}, ${short}`;
}
