// The merchant key arrives once in the link (?k=), is kept for the tab session, and is then sent as a header.
// Never log it. Storage can be blocked (private mode), so every access is guarded and mirrored in memory.
const memory = new Map<string, string>();
const slot = (shop: string) => `mk:${shop}`;

export function loadMerchantKey(shop: string, fromUrl: string | null | undefined): string {
  const url = (fromUrl ?? '').trim();
  if (url) {
    memory.set(shop, url);
    try {
      globalThis.sessionStorage.setItem(slot(shop), url);
    } catch {
      // memory copy is enough
    }
    return url;
  }
  try {
    const stored = globalThis.sessionStorage.getItem(slot(shop))?.trim();
    if (stored) return stored;
  } catch {
    // fall through to memory
  }
  return memory.get(shop) ?? '';
}

export function forgetMerchantKey(shop: string): void {
  memory.delete(shop);
  try {
    globalThis.sessionStorage.removeItem(slot(shop));
  } catch {
    // nothing stored or storage blocked
  }
}
