import type { RequestStatus } from '../api-types';

const ALLOWED: Record<RequestStatus, RequestStatus[]> = {
  open: ['notified', 'closed'],
  notified: ['reserved', 'closed'],
  reserved: ['picked_up', 'closed'],
  picked_up: [],
  closed: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return ALLOWED[from].includes(to);
}
