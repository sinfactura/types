declare global {
  // OAuth wire shapes (per-tenant MercadoLibre seller connect; clones the
  // MercadoPago Connect contract shapes)

  // Response from ML's token endpoint:
  //   POST https://api.mercadolibre.com/oauth/token
  // Used by both the initial code→token exchange and the refresh flow.
  // ML refresh tokens are SINGLE-USE rotated (last-only-valid) and
  // `expires_in` must be read at runtime — the docs self-contradict on
  // the access-token TTL (3 h vs 6 h).
  interface MlOauthTokenResponse {
    access_token: string;
    token_type?: string;
    expires_in: number; // seconds — authoritative over any documented TTL
    scope?: string;
    user_id: number;
    refresh_token: string;
  }

  // BE → FE response from POST /mercadolibre/oauth/initiate.
  interface MlOauthInitiateResponse {
    authorizationUrl: string;
  }

  /**
   * @deprecated PHANTOM — the OAuth callback never returns JSON: every branch
   * answers HTTP 302 with an empty body and a redirect `Location`. No producer
   * exists; nothing should consume this. (Status/disconnect DTOs below are real.)
   */
  interface MlOauthCallbackResponse {
    connected: true;
    storeId: string;
    mercadolibreUserId: string;
    expiresAt: number;
    connectedAt: number;
  }

  // BE → FE response from POST /mercadolibre/oauth/disconnect.
  interface MlOauthDisconnectResponse {
    disconnected: true;
    storeId: string;
  }

  // Stable OAuth/connection error vocabulary surfaced to the FE connect
  // screen. `invalid_operator_user_id` is the ML
  // operator-sub-account state — the seller authorized with a
  // collaborator account; FE CTA: "reconectá con la cuenta principal".
  // `ML_SELLER_ALREADY_LINKED` is the seller-uniqueness state —
  // the exchange SUCCEEDED but that ML account is already linked to another
  // store; distinct from OAUTH_EXCHANGE_FAILED (which means the exchange
  // itself failed). FE CTA: "esta cuenta de ML ya está vinculada a otra tienda".
  type MlOauthErrorCode =
    | "OAUTH_USER_DENIED"
    | "OAUTH_STATE_MISMATCH"
    | "OAUTH_EXCHANGE_FAILED"
    | "ML_OAUTH_NOT_CONFIGURED"
    | "ML_REDIRECT_URI_MISMATCH"
    | "ML_OFFLINE_ACCESS_NOT_GRANTED"
    | "ML_OPERATOR_SUB_ACCOUNT"
    | "ML_SELLER_ALREADY_LINKED";

  // FE-safe DTO returned by GET /mercadolibre/status.
  // Strips tokens and any field that must never leave the BE. The FE
  // renders the Integrations hub card + Configuración tab from this.
  interface MercadolibreStatus {
    connected: boolean;
    status: MercadolibreConnectionStatus;
    userId?: string;
    nickname?: string;
    connectedAt?: number;
    expiresAt?: number;
    /* ML auto-invoicing is RETIRED, and with it the four fields this DTO used
     * to carry: `autoInvoice`, `autoCreditNote`, `defaultPosId` and
     * `facturadorAttestedAt`. The endpoint stopped populating them; leaving
     * them declared kept a published instruction to gate a control that no
     * longer exists, which is worse than an absent field. ML invoices now emit
     * against the store's ordinary `afip.pointOfSale`, and a factura reaches
     * an ML order through `POST /invoices` like any other sale.
     *
     * Legacy VALUES may still sit on the Store row — forward-only, never
     * migrated — but nothing reads or writes them. See `Mercadolibre` in
     * `store.ts`, where they stay declared for exactly that reason. */
    syncPolicy?: Mercadolibre["syncPolicy"];
  }

  // Webhook shapes (topic notifications)

  // Pointer envelope ML POSTs to the notifications callback. UNSIGNED —
  // no HMAC header exists for marketplace notifications (ADR-0018); the
  // trust model is fast-ACK + idempotency claim + canonical re-fetch of
  // `resource` with the tenant's own token + `application_id` check.
  interface MlWebhookEvent {
    _id: string;
    resource: string; // e.g. '/orders/2195160686' — re-fetched, never trusted
    user_id: number; // seller — resolves the tenant via mercadolibreUserId-PK
    topic: string; // payload topic values (e.g. 'orders_v2', 'items', 'stock-location')
    application_id: number;
    attempts: number;
    sent: string; // ISO 8601
    received: string; // ISO 8601
  }

  // Product↔listing mapping wire shapes (the SKU mapping workbench contract)

  // FE bucket grades for a match suggestion (Vinculadas / Para revisar /
  // Sin vincular).
  type MlMatchGrade = "vinculada" | "para-revisar" | "sin-vincular";

  // What the auto-match pass keyed on. Cascade order: SKU → GTIN → title.
  type MlMatchBasis = "seller_sku" | "gtin" | "title";

  // One suggestion row in the mapping workbench. The UP-variant is the
  // match unit (User Products migration) — `externalId` alone cannot
  // express UP-variant granularity.
  interface MlMatchSuggestion {
    productId: string;
    sku?: string;
    mlItemId: string;
    mlTitle?: string;
    userProductId?: string;
    familyId?: string;
    variationId?: string;
    grade: MlMatchGrade;
    basis?: MlMatchBasis;
  }

  // WebSocket frames (order ingestion broadcasts)

  // Payload for the optional dedicated `mercadolibre_order` WS action
  // (underscore naming per KNOWN_SOCKET_ACTIONS). Day-one ingestion rides
  // the existing `orders` frames; this is the lean channel-scoped event
  // for ML-specific FE surfaces (badge/snackbar), mirroring the
  // PaymentReceivedWsPayload live-tail pattern.
  interface MercadolibreOrderWsPayload {
    orderId: string;
    mlOrderId: string;
    packId?: string;
    buyerNickname?: string;
    total: number;
    currency: string; // catalogId
    paidAt?: number; // unix ms
  }

  // Per-field validation errors — shared by every /items-family write.
  //
  // The publish-composer shapes that used to sit here (GtinRequirementTag,
  // MlAttribute, MlRequiredAttribute, MlCategoryPrediction,
  // MlCategoryCandidate, PublishPrediction, MlCategoryAttributeSchema,
  // MlPublishRequest, MlPublishResponse) were removed in 1.10.8 —
  // SINFACTURA dropped the create-a-new-listing flow.
  //
  // `MlFieldError` deliberately survived that removal: it is not
  // composer-only — api's `mapMlErrorCause` uses it for every
  // /items-family write including `setListingStatus` (a manage-existing
  // flow), and app's `getMlFieldErrors` narrows off this ambient global
  // with no local declaration, so deleting it breaks app's typecheck.

  // One per-field error in the 422 ML_VALIDATION_FAILED envelope
  // (`fieldErrors: MlFieldError[]`) — ML's `cause[]` mapped to the
  // request-body path (leading `item.` stripped; no usable reference
  // → 'general'). `type`: 'warning' is non-blocking (ML often
  // auto-fills the field), 'error' blocks until corrected.
  interface MlFieldError {
    field: string;
    code?: string;
    message: string;
    type?: "warning" | "error";
    causeId?: number;
  }

  // ── Conciliación Financiera — ML's own billing reports ─────────────────
  //
  // The ACTUALS side of fee reconciliation: what ML really billed the seller
  // for a month, ingested from `GET /billing/integration/...`. Distinct from
  // `OrderMercadolibre.fees`, which is ML's PREDICTION stamped at order
  // ingest.

  /**
   * One charge or bonus line off `summary/details`'s `bill_includes`.
   *
   * ⚠️ `type` is deliberately a bare `string`, not a union. ML's own
   * documentation calls its observed codes non-exhaustive (`CV` cargo por
   * venta, `CXD` cargo por Mercado Envíos, `PADS` Product Ads, `BXD` for
   * BOTH bonus categories — ML distinguishes those two only by `label`,
   * not by a per-category code). A closed union would drop a line the day
   * ML adds a code, and dropping a money line is worse than carrying an
   * unrecognised one.
   *
   * ⚠️ A line carries NO order reference of any kind — `{label, amount,
   * type, groupId}` is the whole shape. That is why commission and shipping
   * reconcile at PERIOD level and not per order; see
   * `OrderMercadolibre.settlement` for the same point from the other side.
   */
  interface MercadolibreSettlementLine {
    type: string;
    label: string;
    amount: number;
    /** ML's own grouping id for the line. Opaque — carried, never interpreted. */
    groupId?: number;
  }

  /**
   * One ingested ML billing period, keyed `ML_SETTLEMENT_PERIOD#{storeId}` /
   * `{periodKey}`.
   *
   * ⚠️ `periodStatus: 'OPEN'` means the numbers STILL MOVE — ML re-states an
   * open period until it closes. Read an OPEN period as provisional and
   * re-pull after close; do not reconcile against one and call it settled.
   */
  interface MercadolibreSettlementPeriod {
    storeId: string;
    /** `YYYY-MM-01` — the first day of the billing month, ML's own key. */
    periodKey: string;
    periodStatus: "OPEN" | "CLOSED";
    charges: MercadolibreSettlementLine[];
    bonuses: MercadolibreSettlementLine[];
    /** `bill_includes.total_amount` — the period's bill total. */
    totalAmount?: number;
    /** `bill_includes.total_perceptions`. AR sellers only; absent elsewhere. */
    totalPerceptions?: number;
    /**
     * Amount still pending payment on the period — the debt-alert signal.
     * ⚠️ Absent means "not reported by ML on this pull", never "zero".
     */
    unpaidAmount?: number;
    /** ML's own payment due date for the period, as ML states it (`YYYY-MM-DD`). */
    expirationDate?: string;
    currency?: string; // ML's own currency_id for the period, e.g. 'ARS'
    /**
     * ML answered `206 Partial Content` — the report was not fully generated,
     * so what is stored here is INCOMPLETE and the poller will re-pull it.
     * ⚠️ A partial period must not be treated as an authority on anything;
     * it exists so a partial pull is not silently indistinguishable from a
     * complete one.
     */
    partial?: boolean;
    ingestedAt: number; // unix ms
  }

  /** `GET /mercadolibre/settlement` — the operator's period list. */
  interface MercadolibreSettlementPeriodsResponse {
    message: string;
    data: MercadolibreSettlementPeriod[];
    LastEvaluatedKey?: Record<string, unknown>;
  }
}

export {}; // NOSONAR
