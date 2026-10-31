// Soundbox announcements. Pure and client-safe: the speak route and the board both build text here.
export const soundboxOn = (process.env.NEXT_PUBLIC_SOUNDBOX ?? '').trim() === '1';

export const SOUNDBOX_MAX = 120;

export function newRequestText(label: string | null, budget: number | null): string {
  const item = (label ?? '').replace(/\s+/g, ' ').trim();
  if (!item) return 'Nayi maang aayi';
  const tail = budget !== null && budget > 0 ? `, ${Math.round(budget)} rupaye tak` : '';
  const head = 'Nayi maang: ';
  const room = SOUNDBOX_MAX - head.length - tail.length;
  const cut = item.length > room ? `${item.slice(0, Math.max(0, room - 1)).trimEnd()}…` : item;
  return `${head}${cut}${tail}`;
}

export function notifiedText(n: number): string {
  return `${n} customers ko bata diya gaya.`;
}
