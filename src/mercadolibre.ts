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

  // BE → FE response from GET /mercadolibre/oauth/callback.
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
    autoInvoice?: boolean;
    autoCreditNote?: boolean; // Read side of the auto-NC toggle.
    defaultPosId?: number;
    /** When the operator attested ML's own Facturador is OFF
     * (epoch ms); absent = never attested. FE gates the autoInvoice toggle
     * on this. */
    facturadorAttestedAt?: number;
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
}

export {}; // NOSONAR
