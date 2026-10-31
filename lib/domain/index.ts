// Pure business rules. Frozen public surface; implementations live in sibling files.
//
// time.ts
//   todayIST(now?: Date): string                         // YYYY-MM-DD in Asia/Kolkata
//   addDaysISO(iso: string, n: number): string
//   resolveRelative(rel: RelativeDeadline, todayISO: string): string | null   // re-export of resolveDeadline from lib/voice-fallback
//   isValidFutureISO(iso: string, todayISO: string, maxDays?: number): boolean // today..today+365
//   formatDeadline(iso: string | null, todayISO: string): string               // "Aaj, 31 Oct" | "Kal, 1 Nov" | "Sun, 2 Nov" | "—"
// cluster.ts
//   budgetBucket(max: number | null): string                                    // 'any' | '250'|'500'|'1000'|'2000'|'5000' | '5000+'
//   clusterKey(r: { urgent: boolean; item_key: string | null; hard_constraints: string[]; max_budget: number | null }): string | null
//   clusterLabel(item_key: string, hard_constraints: string[], bucket: string): string
// expiry.ts
//   isExpired(r: { needed_by: string | null; status: RequestStatus }, todayISO: string): boolean
// match.ts
//   matchProducts(r: { item_key: string | null; hard_constraints: string[]; max_budget: number | null }, products: Product[]): { eligible: Product[]; rejected: ProductRejection[] }
// status.ts
//   canTransition(from: RequestStatus, to: RequestStatus): boolean
// format.ts
//   maskPhone(phone: string | null): string | null      // "******0101"
//   formatINR(n: number): string                         // "₹1,000"
//   formatRs(n: number): string                          // "Rs 1,000"
export * from './time';
export * from './cluster';
export * from './expiry';
export * from './match';
export * from './status';
export * from './format';
