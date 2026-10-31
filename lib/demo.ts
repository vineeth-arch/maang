// Single allowlist shared by public pages and read-only server routes.
export const DEMO_STORES = { toys: 'neighbourhood-toys', electronics: 'electronics-andheri' } as const;
export type DemoStore = keyof typeof DEMO_STORES;
export const DEMO_READ_ONLY = 'Demo view is read-only. The presenter runs the live flow.';
export function demoSlug(store: string): string | null {
  return Object.hasOwn(DEMO_STORES, store) ? DEMO_STORES[store as DemoStore] : null;
}
export function demoStore(slug: string): DemoStore | null {
  return (Object.keys(DEMO_STORES) as DemoStore[]).find((key) => DEMO_STORES[key] === slug) ?? null;
}
export function merchantHref(shop: string, k: string, view: 'board' | 'insights' | 'settings', demo = false): string {
  if (demo) return `/demo/${demoStore(shop)}/${view}`;
  return `/m/${encodeURIComponent(shop)}${view === 'board' ? '' : `/${view}`}?k=${encodeURIComponent(k)}`;
}
export function merchantRead(shop: string, view: 'board' | 'insights', demo = false): string {
  return demo ? `/api/demo/${view}/${encodeURIComponent(shop)}` : `/api/merchant/${encodeURIComponent(shop)}/${view}`;
}
