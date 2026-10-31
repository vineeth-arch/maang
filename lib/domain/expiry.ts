import type { RequestStatus } from '../api-types';

export function isExpired(r: { needed_by: string | null; status: RequestStatus }, todayISO: string): boolean {
  return r.needed_by !== null && r.needed_by < todayISO && (r.status === 'open' || r.status === 'notified');
}
