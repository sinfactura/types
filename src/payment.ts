declare global {
  /**
   * The ONLY fields the provider-side audit rows genuinely share.
   *
   * All four are optional at EVERY write site — verified against the code, not
   * assumed: MP's Preference create takes them from optional Zod fields and
   * spreads them conditionally; MP's payment row derives them from
   * `parseMpExternalReference`, whose legacy-regex fallback sets AT MOST ONE of
   * the four per payment; Stripe reads them off `Stripe.Metadata`, an
   * unstructured `Record<string, string>` Stripe imposes no schema on. Treat a
   * populated field as a bonus, never as a guarantee.
   *
   * Deliberately NOT a single shared row interface. The three rows below have
   * different keys, lifecycles and required fields, and forcing one shape would
   * make real fields optional on both providers to buy nothing.
   */
  interface PaymentAuditLinkage {
    orderId?: string;
    invoiceId?: string;
    customerId?: string;
    accountId?: string;
  }

  /**
   * `MP#{storeId}` row written when a Checkout Preference is created.
   * `SK` is the Preference id, NOT a payment id — this row records an intent,
   * and no payment may ever follow it.
   *
   * ⚠️ The handler also spreads MercadoPago's raw Preference response onto this
   * row. Those fields are deliberately NOT declared: they are a third-party
   * shape we neither own nor version, and enumerating them here would turn the
   * next MP SDK change into a silent lie in this contract. Read them as
   * provider passthrough.
   */
  interface MpPreferenceAuditRow extends PaymentAuditLinkage {
    PK: string;
    SK: string;
    entityType?: string;
    createdAt: number;
  }

  /**
   * `MP#{storeId}` row keyed by PAYMENT id — written by the webhook and by the
   * recovery endpoint.
   *
   * ⚠️ Carries `total` with NO currency field. That is the shape as written
   * today, not an omission in this declaration: the sibling
   * `PAYMENT#{storeId}` row for the same payment DOES store a currency, and
   * the value is computed but dropped on this path. A consumer must NOT infer
   * denomination from the store's display currency — that inference is the
   * documented root cause of a live denomination bug on the ledger side.
   */
  interface MpPaymentAuditRow extends PaymentAuditLinkage {
    PK: string;
    SK: string;
    entityType?: string;
    createdAt: number;
    dated: number;
    /**
     * ⚠️ OPTIONAL, and the reason is forward-only rather than cosmetic.
     *
     * MercadoPago types `transaction_amount` as optional, so the context this
     * row is built from carries `number | undefined`. Two sibling builders in
     * the same module always defaulted with `?? 0`; the builder behind THIS
     * row did not, and passed the raw value straight through until
     * 2026-08-25. Rows written before that fix can therefore lack the
     * attribute entirely — DynamoDB drops `undefined` rather than storing it.
     *
     * Declaring it required would make this contract true of new rows and a
     * lie about old ones. Tolerate both: a missing `total` means "not
     * recorded", NEVER zero. The sibling `PAYMENT#{storeId}` row is the
     * authoritative amount if you need one.
     */
    total?: number;
    /**
     * MercadoPago's own ISO code, UPPERCASE (`'ARS'`) — deliberately NOT the
     * lowercase catalogId (`'ars'`) that `Account.currency` and the sibling
     * `PAYMENT#{storeId}` row use.
     *
     * The audit rows are the raw forensic tier: they record what the provider
     * said. `PAYMENT#` is the canonicalized cross-provider view. Normalising
     * here while `StripePaymentAuditRow.currency` stays raw would put two
     * spellings of one concept in the same module, which is the failure this
     * split exists to avoid. Note the Stripe path already uppercases its
     * naturally-lowercase codes, so uppercase ISO is the settled convention
     * for this tier rather than an accident of what each provider returns.
     *
     * Optional because rows written before this field existed have no such
     * attribute — absent means "not recorded", never a default.
     */
    currency?: string;
    email?: string;
    cuit?: string;
  }

  /** `STRIPE#{storeId}` row keyed by payment id, written by the webhook. */
  interface StripePaymentAuditRow extends PaymentAuditLinkage {
    PK: string;
    SK: string;
    entityType?: string;
    createdAt: number;
    dated: number;
    total: number;
    currency: string;
    email?: string;
    paymentMethod?: string;
    /** Stripe's event id — required here, no MercadoPago counterpart. */
    stripeEventId: string;
  }

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
    /**
     * MP/Stripe-side `external_reference`, persisted on the row and already
     * carried by `PaymentReceivedWsPayload`. Optional here because the REST
     * projection of older api builds omits it — treat absence as "not
     * projected", not "no reference".
     */
    externalReference?: string;
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
