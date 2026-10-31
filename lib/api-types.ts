// Shared shape contract between API routes (app/api), UI pages and the smoke test.
// Change only by agreement of the lead. Safe to import from client code (types only).
import type { ExtractedRequest, RelativeDeadline } from './contracts';

export type RequestStatus = 'open' | 'notified' | 'reserved' | 'picked_up' | 'closed';
export type CloseReason = 'cannot_meet_deadline' | 'no_longer_needed' | 'not_stockable' | 'duplicate';
export type InputMode = 'voice' | 'typed';
export type ExtractionMode = 'ai' | 'rules_fallback' | 'manual';

export type ErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'unauthorized'
  | 'conflict'
  | 'rate_limited'
  | 'voice_unavailable'
  | 'payload_too_large'
  | 'no_stock'
  | 'not_eligible'
  | 'server_error';

export type ApiError = { error: string; code: ErrorCode };

// ---------- DB rows ----------
export type Product = {
  id: string;
  shop_id: string;
  item_key: string;
  name: string;
  tags: string[];
  price: number;
  stock_available: number;
  synthetic: boolean;
};

export type RequestRow = {
  id: string;
  shop_id: string;
  token: string;
  source_text: string;
  input_mode: InputMode;
  extraction: ExtractedRequest;
  extraction_mode: ExtractionMode;
  item_label: string | null;
  item_key: string | null;
  hard_constraints: string[];
  max_budget: number | null;
  quantity: number | null;
  needed_by: string | null; // YYYY-MM-DD
  urgent: boolean;
  cluster_key: string | null;
  phone: string | null;
  consent: boolean;
  status: RequestStatus;
  close_reason: CloseReason | null;
  matched_product_id: string | null;
  synthetic: boolean;
  created_at: string;
  updated_at: string;
};

// ---------- Customer: capture ----------
// POST /api/capture/transcribe  (multipart form field "audio", audio/wav, max 2 MB)
export type TranscribeResponse = { text: string; language: string };

// POST /api/capture/extract
export type ExtractBody = { shopSlug: string; text: string; mode?: 'rules' | 'ai' };
export type ExtractResponse = ExtractedRequest;

// POST /api/requests
export type CreateRequestBody = {
  shopSlug: string;
  source_text: string;
  input_mode: InputMode;
  extracted: ExtractedRequest;
  answers?: { max_budget?: number | null; needed_by?: RelativeDeadline };
  phone?: string;
  consent: boolean;
};
export type CreateRequestResponse = { id: string; token: string };

// GET /api/requests/[id]?t=
export type CustomerView = {
  id: string;
  shop_name: string;
  item_label: string | null;
  source_text: string;
  status: RequestStatus;
  close_reason: CloseReason | null;
  expired: boolean;
  needed_by: string | null;
  product: { name: string; price: number } | null; // only when notified/reserved/picked_up
  created_at: string;
};

// POST /api/requests/[id]/reserve?t=
export type ReserveResult = 'ok' | 'already' | 'not_notified' | 'out_of_stock';
export type ReserveResponse = { result: ReserveResult; status: RequestStatus };

// POST /api/requests/[id]/cancel?t=
export type CancelResponse = { result: string; status: RequestStatus };

// ---------- Merchant (?k=MERCHANT_KEY) ----------
export type RejectReason = { code: string; text: string }; // e.g. {code:'missing_constraint:rechargeable', text:'uses AA batteries, customer needs rechargeable'}
export type ProductRejection = { product: Product; reasons: RejectReason[] };

export type BoardRequest = {
  id: string;
  source_text: string;
  item_label: string | null;
  item_key: string | null;
  hard_constraints: string[];
  max_budget: number | null;
  needed_by: string | null;
  needed_by_label: string | null;
  urgent: boolean;
  consent: boolean;
  phone_masked: string | null; // "******0101", null when no consent
  status: RequestStatus;
  close_reason: CloseReason | null;
  expired: boolean;
  extraction_mode: ExtractionMode;
  matched_product_id: string | null;
  synthetic: boolean;
  created_at: string;
};

export type Cluster = {
  key: string;
  label: string; // "Rechargeable RC car · under ₹1,000"
  item_key: string;
  count_active: number; // non-expired, status open|notified|reserved
  count_consenting: number; // open, consent, not expired -> "N can be told"
  earliest_needed_by: string | null;
  requests: BoardRequest[]; // active ones, FIFO by created_at
  eligible: Product[]; // matches every hard constraint and bucket; may have stock 0
  rejected: ProductRejection[]; // same item_key, fails constraint/budget
  in_stock_alternatives: ProductRejection[]; // rejected with stock_available > 0
};

export type UrgentItem = BoardRequest & { alternatives: Product[] }; // in-stock same-item_key products, info only

export type Metrics = { captured: number; notified: number; reserved: number; picked_up: number };

// GET /api/merchant/[shop]/board
export type BoardResponse = {
  shop: { slug: string; name: string };
  clusters: Cluster[]; // sorted count_active desc; UI shows eligible.length === 0 in the "No match" lane
  urgent: UrgentItem[];
  unclustered: BoardRequest[]; // active, item_key null, not urgent
  expired: BoardRequest[];
  products: Product[];
  metrics: Metrics; // distinct requests that ever reached each event type
  server_time: string; // ISO timestamp
  today: string; // YYYY-MM-DD in Asia/Kolkata
};

// POST /api/merchant/[shop]/stock
export type StockBody = { product_id: string; add_quantity: number }; // 1..50
export type StockResponse = { product: Product };

// POST /api/merchant/[shop]/clusters/notify
export type NotifyBody = { cluster_key: string; product_id: string };
export type NotifyResponse = { notified_count: number; skipped_no_consent: number; skipped_ineligible: number };

// POST /api/merchant/[shop]/speak  (NEXT_PUBLIC_SOUNDBOX=1 only; returns audio bytes, or 503 voice_unavailable)
// Server builds the text from the request's item_label and max_budget, or from count. Never free text.
export type SpeakBody = { kind: 'new'; request_id: string } | { kind: 'notified'; count: number } | { kind: 'insight' };

// POST /api/merchant/[shop]/requests/[id]/pickup
export type PickupResponse = { result: 'ok' | 'already' | 'not_reserved' };

// POST /api/merchant/[shop]/requests/[id]/close
export type CloseBody = { reason: CloseReason };
export type CloseResponse = { result: string; status: RequestStatus };

// POST /api/admin/reset  (header x-reset-key)
export type ResetResponse = { ok: true; counts: { products: number; requests: number; reservations: number; events: number } };
