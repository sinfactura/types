declare global {
  /**
   * WebSocket broadcast payload for the `payment_received` action, fired when a
   * "money received" event is persisted (MP webhook, Stripe webhook, or MP
   * movements poller). FE should toast with `total`+`currency`+`payerName` and
   * invalidate `PaymentReceived`/`PaymentReceivedUnlinked` RTK Query tags.
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
    // orderId.
    externalReference?: string;
  }

  /**
   * REST shape of a payment row returned by `GET /payments/received`. Distinct
   * from `PaymentReceivedWsPayload` (the lean live-tail WS event): this carries
   * denormalized labels (customerName, orderCode, invoiceCode) attached
   * server-side so the FE doesn't N+1 fetch.
   */
  interface PaymentReceived {
    paymentId: string;
    source: PaymentReceivedSource;
    total: number;
    currency: string;
    // Self-describing currency stamp (ADR-0013): FX rate and Unix ms effective.
    // ⚠️ NOT IMPLEMENTED on this row — the PAYMENT partition never stores it, so
    // these are undefined on 100% of GET /payments/received rows. Absence here
    // does not mean "no FX applied".
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
    // Same-day refund ledger reconciliation, stamped on the `MP#{storeId}/{paymentId}`
    // row when the auto-reversal path runs but can't complete. `reconciled: false`
    // means the operator must reconcile manually.
    // ⚠️ Stamped ONLY on the MP row — GET /payments/received never carries these.
    // Absence here means "not projected", never "reconciled".
    reconciled?: boolean;
    reconcileReason?: string;
  }

  /**
   * Confidence tier for a link suggestion.
   *
   * Mapped from heuristic match strength:
   *   - 'Alta': customer CUIT/email exact OR order amount-exact + ±24h
   *   - 'Media': order amount ±5% within ±7d
   *   - 'Baja': reserved for future broader heuristics (currently unused)
   */
  export type LinkSuggestionConfidence = "Alta" | "Media" | "Baja";

  /**
   * One ranked customer candidate for a payment's link dialog.
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
   * One ranked order candidate for a payment's link dialog. `orderCode` is
   * currently identical to `orderId` (no separate short code on Order today).
   * `currency`/`total` are always in ARS (v1's storage currency); USD-priced
   * orders surface their ARS-equivalent.
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
