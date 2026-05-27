declare global {
  /**
   * WebSocket broadcast payload for the `payment_received` action.
   *
   * Fired by the API when a "money received" event is persisted across any
   * of three sources (MP webhook, Stripe webhook, MP movements poller).
   * Receivers (FE) should:
   *   1. Render an immediate snackbar toast using `total` + `currency` + `payerName`.
   *   2. Invalidate RTK Query tags `PaymentReceived` + `PaymentReceivedUnlinked`
   *      so the canonical row is refetched from `GET /payments/received`.
   */
  type PaymentReceivedSource = "mp" | "stripe" | "mp_movement";

  interface PaymentReceivedWsPayload {
    source: PaymentReceivedSource;
    paymentId: string;
    total: number;
    currency: string; // ISO 4217 (e.g. 'ARS', 'USD')
    payerName?: string;
    paidAt: number; // unix milliseconds
    customerId?: string;
    orderId?: string;
    invoiceId?: string;
    // MP/Stripe-side external_reference. Lets the FE filter the live tail
    // by the new amount-bound /qr/dynamic shape that no longer round-trips
    // orderId (api#959).
    externalReference?: string;
  }

  /**
   * REST shape of a payment row returned by `GET /payments/received` (api#902).
   *
   * Distinct from `PaymentReceivedWsPayload` (api#880, the WS broadcast):
   *   - This carries denormalized labels (customerName, orderCode, invoiceCode)
   *     attached server-side at response time so the FE doesn't N+1 fetch.
   *   - The WS broadcast is the lean live-tail event; this is the canonical row.
   */
  interface PaymentReceived {
    paymentId: string;
    source: PaymentReceivedSource;
    total: number;
    currency: string;
    // Self-describing currency stamp (app#1539 / ADR-0013): FX rate and
    // the Unix ms at which it was effective.
    currencyValue?: number;
    currencyValueAt?: number;
    payerName?: string;
    payerEmail?: string;
    payerCuit?: string;
    paidAt: number; // unix milliseconds
    // Linkage — any one means "linked"
    customerId?: string;
    customerName?: string; // denormalized
    orderId?: string;
    orderCode?: string; // denormalized — equals orderId today
    invoiceId?: string;
    invoiceCode?: string; // denormalized — equals invoiceId today
    accountId?: string;
    linkedAt?: number;
    linkSource?: "auto" | "manual";
  }

  /**
   * Confidence tier for a link suggestion (api#904).
   *
   * Mapped from heuristic match strength:
   *   - 'Alta': customer CUIT/email exact OR order amount-exact + ±24h
   *   - 'Media': order amount ±5% within ±7d
   *   - 'Baja': reserved for future broader heuristics (currently unused)
   */
  export type LinkSuggestionConfidence = "Alta" | "Media" | "Baja";

  /**
   * One ranked customer candidate for a payment's link dialog (api#904).
   * The FE renders the chip with `fullName`, the confidence badge, and the
   * `reason` text verbatim.
   */
  interface CustomerCandidate {
    customerId: string;
    fullName: string;
    cuit?: string;
    email?: string;
    confidence: LinkSuggestionConfidence;
    reason: string;
    score: number;
  }

  /**
   * One ranked order candidate for a payment's link dialog (api#904).
   * `orderCode` is currently identical to `orderId` (no separate short code
   * field on Order today); kept as a distinct field for forward-compat with
   * a future Order.code rollout.
   *
   * `currency` is always 'ARS' in v1 (the storage currency for SINFACTURA's
   * Argentine tenants); USD-priced orders surface their ARS-equivalent total.
   * `total` is therefore in ARS regardless of how the order was originally
   * priced; FE may derive USD display from `Order.currency` (the FX rate)
   * if needed.
   */
  interface OrderCandidate {
    orderId: string;
    orderCode: string;
    customerId: string;
    customerName: string;
    total: number;
    currency: string;
    dated: number;
    confidence: LinkSuggestionConfidence;
    reason: string;
    score: number;
  }

  /**
   * Response shape of `GET /payments/{source}/{paymentId}/link-suggestions`.
   * Both arrays may be empty when no signal — FE renders "Sin sugerencias
   * automáticas" and falls back to manual customer / order search inputs.
   */
  interface LinkSuggestionsResponse {
    customers: CustomerCandidate[];
    orders: OrderCandidate[];
  }
}

export {}; // NOSONAR
