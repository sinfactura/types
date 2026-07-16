declare global {
  // ───────────────────────────────────────────────────────────────
  // OAuth wire shapes (app#797 / api#1572 — per-tenant MercadoLibre
  // seller connect; clones the MercadoPago Connect contract shapes)
  // ───────────────────────────────────────────────────────────────

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

  // BE → FE response from POST /mercadolibre/oauth/initiate (api#1572).
  interface MlOauthInitiateResponse {
    authorizationUrl: string;
  }

  // BE → FE response from GET /mercadolibre/oauth/callback (api#1572).
  interface MlOauthCallbackResponse {
    connected: true;
    storeId: string;
    mercadolibreUserId: string;
    expiresAt: number;
    connectedAt: number;
  }

  // BE → FE response from POST /mercadolibre/oauth/disconnect (api#1572/api#1575).
  interface MlOauthDisconnectResponse {
    disconnected: true;
    storeId: string;
  }

  // Stable OAuth/connection error vocabulary surfaced to the FE connect
  // screen (app#1253). `invalid_operator_user_id` is the ML
  // operator-sub-account state — the seller authorized with a
  // collaborator account; FE CTA: "reconectá con la cuenta principal".
  // `ML_SELLER_ALREADY_LINKED` (api#1707) is the seller-uniqueness state —
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

  // FE-safe DTO returned by GET /mercadolibre/status (api#1572).
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
    autoCreditNote?: boolean; // api#1684 — read side of the auto-NC toggle.
    defaultPosId?: number;
    /** api#1655 — when the operator attested ML's own Facturador is OFF
     * (epoch ms); absent = never attested. FE gates the autoInvoice toggle
     * on this. */
    facturadorAttestedAt?: number;
    syncPolicy?: Mercadolibre["syncPolicy"];
  }

  // ───────────────────────────────────────────────────────────────
  // Webhook shapes (api#1573 — topic notifications)
  // ───────────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────────
  // Product↔listing mapping wire shapes (api#1575 ↔ app#1256 —
  // the SKU mapping workbench contract)
  // ───────────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────────
  // WebSocket frames (api#1574 — order ingestion broadcasts)
  // ───────────────────────────────────────────────────────────────

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

  // ───────────────────────────────────────────────────────────────
  // Publish composer wire shapes (api#1577 ↔ app#1933 — the
  // predict/submit contract; graduated from api in types#99)
  // ───────────────────────────────────────────────────────────────

  // The category's GTIN-attribute requirement, distilled from its
  // tags: 'new_required' = required for condition:new items,
  // 'conditional_required' = required unless an exemption applies.
  type GtinRequirementTag =
    | "not_required"
    | "conditional_required"
    | "new_required";

  // ML's attribute shape, used BOTH on domain_discovery/search's
  // prediction response and on POST /items' request body. `value_id`
  // is a known catalog value; `value_name` alone is a custom value.
  interface MlAttribute {
    id: string;
    name?: string;
    value_id?: string;
    value_name?: string;
    attribute_group_id?: string;
    attribute_group_name?: string;
  }

  // GET /categories/$ID/attributes distilled to per-attribute
  // required-ness (required = any of required / conditional_required /
  // new_required tags; raw `tags` kept alongside) — drives the
  // composer's dynamic required-field renderer.
  interface MlRequiredAttribute {
    id: string;
    name?: string;
    required: boolean;
    tags?: string[];
  }

  // Category prediction bundle inside the publish GET response.
  interface MlCategoryPrediction {
    domainName: string;
    categoryId: string;
    categoryName: string;
    attributes: MlAttribute[];
    requiredAttributes: MlRequiredAttribute[];
    // Awareness only (all MLA condition:new categories read
    // 'required') — never written onto the POST /items body.
    immediatePayment?: "required" | "optional";
    maxTitleLength?: number;
    gtinRequirement: GtinRequirementTag;
  }

  // A single `domain_discovery/search` hit, mapped light (no
  // attribute-schema reads) — the override picker's raw material
  // (api#1664): the FE lets the seller pick any of these instead of the
  // top-1 `MlCategoryPrediction` guess, then calls the category-attribute
  // schema for the picked `categoryId` (graduated from api in types#100).
  interface MlCategoryCandidate {
    domainId?: string;
    domainName: string;
    categoryId: string;
    categoryName: string;
  }

  // `data` of GET /mercadolibre/products/publish?productId=X.
  interface PublishPrediction extends MlCategoryPrediction {
    isUpMigrated: boolean;
    // ALL `domain_discovery/search` hits (ML's own probability order,
    // top-1 included), mapped light — the confirm/override picker's
    // candidate list (api#1664, graduated in types#100).
    candidates: MlCategoryCandidate[];
  }

  // Standalone category-attribute-schema bundle for the publish composer's
  // override arm (api#1664) — callable directly against any FE-picked
  // `categoryId` (e.g. a `PublishPrediction.candidates` entry) without
  // re-running domain_discovery (graduated from api in types#100).
  interface MlCategoryAttributeSchema {
    categoryId: string;
    requiredAttributes: MlRequiredAttribute[];
    gtinRequirement: GtinRequirementTag;
    maxTitleLength?: number;
    immediatePayment?: "required" | "optional";
  }

  // POST /mercadolibre/products/publish request body. The BE
  // re-derives isUpMigrated / gtinRequirement / maxTitleLength
  // server-side from `categoryId` — the predict step's answers are
  // never trusted on submit.
  interface MlPublishRequest {
    productId: string;
    categoryId: string;
    attributes: MlAttribute[];
    listingTypeId: string;
    saleTerms?: Record<string, unknown>[];
    pictures?: { url: string }[];
    description?: string;
  }

  // `data` of the publish POST success response.
  interface MlPublishResponse {
    productId: string;
    itemId: string;
    userProductId?: string;
    isUpMigrated: boolean;
    status: "linked";
  }

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
