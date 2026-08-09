declare global {
  interface Config {
    // PK // global config
    appVersion: number;
    fiscalConditions: FiscalCondition[];
    ivaTypes: Method[];
    minWithDni: number;
    stats: {
      store: number;
    };
  }

  interface Ecommerce {
    isActive?: boolean;
    config?: {
      showDefaultPriceList?: number; // 0: NONE, 1: PUBLICO, 2: TECNICO, 3: GREMIO, 4: MAYORISTA
      showStocks?: boolean;
    };
    sidebar?: {
      show?: boolean;
      categories?: boolean;
      brands?: boolean;
      incomes?: boolean;
      favorites?: boolean;
      basket?: boolean;
      orders?: boolean;
      invoices?: boolean;
    };
    home?: {
      displayCurrencyCard?: boolean;
      displayCurrencyDetails?: boolean;
      displayProfile?: boolean;
      displayFeaturedProducts?: boolean;
      displayCategories?: boolean;
      displayPaymentCard?: boolean;
      displayWhatsappCard?: boolean;
      displayOrders?: boolean;
    };
    footerBar?: {
      show?: boolean;
      orders?: boolean;
      invoices?: boolean;
      basket?: boolean;
      favorites?: boolean;
    };
    themeColors?: {
      main?: string;
      navbar?: string;
    };
    appVersion?: number;
    stats?: Record<string, string>;
  }

  /**
   * Platform globals forwarded to a tenant session on `GET /store`.
   *
   * A read-time projection of the `GLOBALS`/`PLATFORM` row, never a stored
   * attribute of the STORE row: the api decides per registered key whether it
   * crosses this boundary (`forwardToTenants` in `globalsDefaults.ts`), so
   * operator-only keys — the AI spend ceilings — are absent by construction.
   * Every member is optional: a key the api has not registered, or has not
   * marked forwardable, simply will not be here.
   */
  interface StoreGlobals {
    /** ARCA/AFIP "Consumidor Final" DNI threshold, in pesos. */
    minWithDni?: number;
    /** Cmd-K usage telemetry collection. */
    commandPaletteTelemetry?: boolean;
  }

  interface Store {
    storeId: string;
    createdAt: number;
    // Tenant kind. Absent / 'production' = real tenant; 'demo' = demo/showcase
    // store (guarded from real email/SMS/surveys).
    type?: 'production' | 'demo';
    name: string;
    // Optional: a freshly-registered store has no address until the operator
    // fills one in. Readers guard with `?.`.
    address?: {
      street: string;
      postalCode: string;
      city: string;
      province: string;
    };
    cuit: string;
    phone: string;
    email: string;
    acknowledgedSharedCuit?: boolean; // recorded when registered past the shared-CUIT gate
    // SUPERVISOR-readable subscription summary — response-time join, not a persisted Store attribute.
    subscription?: StoreRowSubscriptionSummary;
    // Functional config, not a feature-flag bag.
    config: {
      priceDecimals: 0 | 1 | 2 | 3;
      stock: boolean;
      changePrice: boolean;
      /**
       * Back-office display currency (catalogId) the operator's screens are
       * framed in — distinct from any individual money entity's own `currency`
       * stamp. Also the denomination fallback for unstamped legacy `Account` rows.
       */
      displayCurrency?: string;
      /** Seed catalogId for new Product writes (FE currency-selector default); does not reinterpret existing rows. */
      defaultProductCurrency?: string;
      /** Seed catalogId for new Account / SupplierAccount writes (FE currency-selector default); does not reinterpret existing rows. */
      defaultAccountCurrency?: string;
      /**
       * ADR-0004 §5 — tenant opt-out from AI product enrichment. Absent does
       * NOT block; only an explicit `true` blocks. The api gate fails CLOSED
       * on a read failure but open on a missing field.
       */
      aiOptOut?: boolean;
      /**
       * Per-category × per-channel notification/feedback defaults; absent ⇒
       * FE falls back to all-on. FE-read only — `PATCH /store` validates shape only.
       */
      feedbackDefaults?: Record<string, { sound?: boolean; visual?: boolean }>;
      /**
       * Guided-setup onboarding progress (ADR-0020). First-login is derived
       * FE-side (absent, or neither `completed` nor `skipped` ⇒ show wizard).
       */
      onboarding?: { step: number; completed: boolean; skipped: boolean };
    };
    ecommerce?: Ecommerce;
    photoURL: string;
    photoData?: string;
    removePhotoURL?: string;
    // STORE row reverse-lookup by tenant MP user_id — hot path for the
    // per-tenant payment webhook. Sparse (only active MP connections carry it);
    // KEYS_ONLY because a follow-up Get fetches the full row with the access token.
    mercadopagoUserId?: string;
    // STORE row reverse-lookup by tenant ML seller user_id — hot path for
    // unsigned-webhook tenant resolution. Sparse mirror of
    // `integrations.mercadolibre.userId` (DDB GSIs can't index nested attributes);
    // feeds the KEYS_ONLY `mercadolibreUserId-PK` GSI.
    mercadolibreUserId?: string;
    currencies: StoreCurrencySubscription[];
    cashInMethods: Method[];
    cashOutMethods: Method[];
    debitMethods: Method[];
    priceLists: PriceList[]; // was Method[] — PriceList ⊇ Method, so type-compatible
    accountMethods: Method[];
    deliveryMethods: Method[];
    paymentMethods: Method[];
    brands: Brand[];
    categories: Category[];
    themeColors?: {
      main?: string;
      navbar?: string;
    };
    stats: {
      customers?: number;
      invoices?: number;
      orders?: number;
      products?: number;
      users?: number;
    };
    integrations?: StoreIntegrations;
    fxAutoUpdate?: StoreFxAutoUpdate;
    appVersion: number;
    fiscalConditions: FiscalCondition[];
    ivaTypes: Method[];
    globals?: StoreGlobals;
    maintenance?: MaintenanceInfo;
    // Last cert-expiry alert fired for the current cert, so the daily cron
    // doesn't re-alert within a band; keyed to expiry ms so a renewed cert auto-resets.
    afipCertAlert?: {
      expiry: number;
      band: 'expired' | '14' | '30' | '60';
    };
    // White-label transactional-email sender, distinct from the `email` contact
    // string. `verified` is BE-set only after the SES identity is confirmed.
    emailSender?: {
      from?: string;
      verified?: boolean;
    };
    // Pre-launch landing lead-capture marker; cleared by the
    // `convert-waitlist` operator endpoint (which fires the deferred welcome email).
    waitlist?: boolean;
  }

  interface StoreIntegrations {
    afip?: Afip;
    mercadopago?: Mercadopago;
    // Per-tenant WhatsApp Business connection.
    whatsapp?: WhatsAppConfig;
    // Per-store SMS entitlement. The smsmasivos account is shared
    // platform-wide; this flag gates whether a store may consume it. Future
    // SMS-pack metering (balance, packId, monthlyLimit) extends this blob.
    sms?: SmsIntegration;
    // Per-tenant Gmail OAuth send connection — gmail.send scope only.
    gmail?: Gmail;
    // Per-tenant MercadoLibre seller connection.
    mercadolibre?: Mercadolibre;
  }

  interface SmsIntegration {
    /** When true, the store may send SMS through the shared platform account. */
    enabled?: boolean;
    // Per-store SMS signature (firma) appended to outbound order SMS
    // bodies. Unset means no firma is appended (graceful fallback).
    signature?: string;
  }

  interface Gmail {
    connected?: boolean;
    senderEmail?: string;
    /** KMS-encrypted refresh token — never returned in API responses. */
    refreshTokenEncrypted?: string;
    scopes?: string[];
    connectedAt?: number;
    status?: 'connected' | 'expired' | 'disconnected' | 'error' | 'never';
    disconnectedAt?: number;
    lastTokenRefreshAt?: number;
    tokenRefreshFailures?: number;
    // Lazily-refreshed access-token cache for the Gmail send path,
    // mirrors mercadopago.{accessToken,expiresAt}. KMS-encrypted; NEVER
    // returned in any API response (redacted by `_status.ts`).
    accessTokenEncrypted?: string;
    accessTokenExpiresAt?: number;
  }

  type FxAutoUpdateStrategy = "overwrite" | "overwrite-if-stale" | "notify-only";

  interface FxAutoUpdateBinding {
    catalogId: string; // FK to PlatformCurrency
    sourceId: string; // PLATFORM/FX_SOURCES.sources[].id
    strategy: FxAutoUpdateStrategy;
    lastUpdatedAt?: number; // unix ms — set by propagate-fx worker
    lastValue?: number; // last value the worker observed
  }

  interface StoreFxAutoUpdate {
    enabled: boolean;
    bindings: FxAutoUpdateBinding[]; // max 32 enforced by BE Zod
  }

  interface Mercadopago {
    // OAUTH CONNECTION — set by /mercadopago/oauth/callback.
    userId?: string; // MP user_id; string for precision safety.
    accessToken?: string; // V1 plaintext; KMS-encrypted since.
    refreshToken?: string; // V1 plaintext; KMS-encrypted since.
    expiresAt?: number; // unix ms when accessToken expires.
    connectedAt?: number; // unix ms when OAuth flow completed.
    tokenType?: string; // 'bearer'.
    scope?: string; // granted scopes, e.g. 'offline_access read write'.
    liveMode?: boolean; // true when connected to MP production credentials.
    publicKey?: string; // MP public key — safe to expose to the FE for SDK use.

    // STATUS / OPS — written by refresh + disconnect.
    status?: MercadopagoConnectionStatus;
    disconnectedAt?: number; // unix ms; admin-triggered disconnect.
    lastTokenRefreshAt?: number;
    tokenRefreshFailures?: number;

    // PER-STORE CONFIG — admin-controlled from Integrations hub.
    statementDescriptor?: string; // shows on customer's bank statement.
    notificationUrl?: string; // webhook URL registered with MP.

    pos?: {
      defaultDeviceId?: string; // selected POS terminal id.
      defaultStoreMpId?: string; // MP's store_id for multi-branch merchants.
    };

    staticQr?: {
      posId: string; // MP-issued POS numeric id (stringified).
      externalPosId: string; // SINFACTURA-pinned external id (`SF-{storeId}`).
      createdAt: number; // unix ms when the POS was created.
    };

    dynamicQrPos?: {
      posId: string; // MP-issued POS numeric id (stringified).
      externalPosId: string; // SINFACTURA-pinned external id (`SF{storeId}DYN`).
      createdAt: number; // unix ms when the POS was created.
    };

    // Money-movement poller checkpoint — unix ms of the
    // latest MP payment/movement date already ingested. `mpMovementsPoller`
    // advances it monotonically so the next poll walks forward from here.
    // Supersedes the lambda-local `MpWithCheckpoint` cast in
    // `api/stacks/lambdas/mpMovementsPoller/_pollTenant.ts`.
    lastMovementCheckpoint?: number;

    // FEATURE TOGGLES per store, surfaced in the FE Integrations hub.
    features?: {
      checkoutPro?: boolean; // online payments via Checkout Pro.
      pointOfSale?: boolean; // in-person QR / Point.
      subscriptions?: boolean; // recurring billing (future).
    };

    // LEGACY — pre-OAuth FE-issued field, kept for
    // backwards compat during migration; cleared after migration ships.
    code?: string;
  }

  type MercadopagoConnectionStatus = "connected" | "expired" | "disconnected" | "error" | "never";

  // `needs-reauth` is ML-specific (ADR-0018 Amendment B): single-use
  // refresh-token rotation means a hard `invalid_grant` or a dangling
  // refresh-attempt marker is terminal — the seller must reconnect.
  type MercadolibreConnectionStatus =
    | "connected"
    | "expired"
    | "disconnected"
    | "error"
    | "needs-reauth"
    | "never";

  interface Mercadolibre {
    // OAUTH CONNECTION — set by /mercadolibre/oauth/callback.
    userId?: string; // ML seller user_id; string for precision safety.
    nickname?: string; // seller nickname — FE hub card display.
    /** KMS-encrypted (`alias/ml-oauth-tokens`) — never returned in API responses. */
    accessTokenEncrypted?: string;
    /** KMS-encrypted. SINGLE-USE rotated by ML (last-only-valid) — never returned. */
    refreshTokenEncrypted?: string;
    expiresAt?: number; // unix ms when accessToken expires (`expires_in` read at runtime).
    connectedAt?: number; // unix ms when OAuth flow completed.
    tokenType?: string; // 'Bearer'.
    scope?: string; // granted scopes — must include 'offline_access read write'.

    // STATUS / OPS — written by refresh-on-use + disconnect.
    status?: MercadolibreConnectionStatus;
    disconnectedAt?: number; // unix ms; admin-triggered disconnect.
    lastTokenRefreshAt?: number;
    /** Transient (network/5xx) failures only — a hard `invalid_grant` is
     * terminal on FIRST occurrence (→ `needs-reauth`), never counted. */
    tokenRefreshFailures?: number;
    /** Write-ahead refresh-attempt marker (ADR-0018 Amendment B): unix ms
     * persisted BEFORE calling ML's token endpoint. A dangling marker found
     * by the next lock-acquirer means the previous winner may have burned
     * the single-use refresh token → go straight to `needs-reauth`. */
    refreshAttemptAt?: number;

    // PER-STORE CONFIG — admin-controlled from the
    // Integrations hub Configuración tab.
    /** Per-channel auto-invoice toggle — default OFF; enabling requires
     * `defaultPosId` (dedicated PdV) + the Facturador-collision check. */
    autoInvoice?: boolean;
    /** Auto-emit a Nota de Crédito when a full-sale ML return is finalized —
     * default OFF; requires `autoInvoice` and rides the same
     * dedicated-PdV + Facturador-collision guards. */
    autoCreditNote?: boolean;
    defaultPosId?: number; // dedicated AFIP PdV for the ML channel.
    /** Epoch ms of the operator's attestation that ML's own Facturador is
     * OFF for this account — required before `autoInvoice` can
     * be enabled (no public ML API exposes Facturador state). Audit trail;
     * absent = never attested. */
    facturadorAttestedAt?: number;
    // Outbound stock-sync knobs, applied in order: buffer → limit → pause
    // (industry-convergent; persisted via diff-PATCH).
    syncPolicy?: {
      stockBuffer?: number; // subtract from local stock before publishing.
      stockLimit?: number; // hard cap on published stock.
      paused?: boolean; // pause ALL outbound sync (inbound keeps flowing).
    };
  }

  // Mercadolibre PATCH write shape

  /**
   * Wire/write shape for `mercadolibre.syncPolicy` accepted by `PATCH /store` —
   * distinct from the read-side `Mercadolibre['syncPolicy']` because each knob
   * additionally accepts `null` to mean "clear it" (WRITE-ONLY: the BE deletes
   * the knob rather than ever persisting a DynamoDB `null`).
   */
  interface MercadolibreSyncPolicyInput {
    stockBuffer?: number | null;
    stockLimit?: number | null;
    paused?: boolean | null;
  }

  /**
   * Full write shape for the `mercadolibre` key of `PATCH /store`'s body.
   * `defaultPosId` accepts `null` to clear it — same WRITE-ONLY null-means-remove
   * convention as `syncPolicy`'s knobs. `autoInvoice` is a plain boolean, never
   * nullable. Prefer this over `Partial<Mercadolibre>` for PATCH bodies — the
   * read-side interface can't express write-time null-clear semantics.
   */
  interface MercadolibrePatchInput {
    autoInvoice?: boolean;
    /** Auto-emit a Nota de Crédito on a finalized full-sale ML return; BE-enforced: requires `autoInvoice` true (400 otherwise). */
    autoCreditNote?: boolean;
    defaultPosId?: number | null;
    /** WRITE-ONLY attestation flag: `true` = operator confirms ML's own
     * Facturador is OFF. BE stamps `facturadorAttestedAt`; the boolean itself
     * is never persisted. Required when `autoInvoice` flips to `true` (else 422). */
    facturadorAttested?: boolean;
    syncPolicy?: MercadolibreSyncPolicyInput;
  }

  interface Afip {
    production: boolean;
    address?: string;
    city?: string;
    condFiscal?: number;
    cuit?: string;
    condFiscalName?: string;
    postalCode?: string;
    province?: string;
    razonSocial?: string;
    pointOfSale?: number; // PTO_VTA
    activitiesStartedAt?: number; // INICIO_ACTIVIDADES
    /** Registered AFIP activity codes (6-digit nomenclador) — drives the
     * IVA Simple F.2051 apertura CSV export; autofillable from Padrón A5. */
    actividades?: number[];
    /** Provincial ISIB transparency config (Ley 27.743 art. 99 adhesions).
     * v1: CABA only (AGIP Res. 169/26 — prints the RATE, never an amount). `rate` is
     * the store's own Ley Tarifaria percentage (e.g. 3.5 → "3,50%"); `regime: 'cm'`
     * adds the Convenio Multilateral second line; `exempt` prints the exempt legend. */
    iibbTransparency?: {
      jurisdiction: 'caba';
      regime: 'local' | 'cm';
      rate: number;
      exempt?: boolean;
    };
    invoiceNote?: string; // NOTA EN FACTURA
    showInvoiceLogo?: boolean; // logo en factura — boolean toggle (was mistyped string)
    // catalogId — FK to PlatformCurrency. The AFIP MonId projection
    // (`'PES' | 'DOL'`) is derived at invoice-write time from
    // `PlatformCurrency.afipCode`; was `1 | 2` (legacy tenant-local Method ids).
    // `StoreCurrencySubscription.value` provides the AFIP `MonCotiz` exchange rate.
    // Narrowed to `CatalogId` so comparisons against the AFIP wire codes
    // fail at compile time; wire-boundary DDB readers may still `as CatalogId`.
    currency: CatalogId;
    cert?: string;
    csr?: string;
    key?: string;
    accessTicket_EB?: string;
    accessTicket_RSF?: string;
    // WSAA ticket for the 'wsfex' service (export invoicing); per-service, 12h TTL.
    accessTicket_FEX?: string;
    // WSAA ticket for the 'wsfecred' service (FCE MiPyME buyer-side ops); per-service, 12h TTL.
    accessTicket_FECRED?: string;
    // WSAA ticket for the 'wscdc' service (third-party voucher constatación); per-service, 12h TTL.
    accessTicket_CDC?: string;
    // Derived read-only flags: cert/key existence, projected on read — never the bytes.
    hasCert?: boolean;
    hasKey?: boolean;
    // RG 5762/2025 Factura M elimination. Per-punto-de-venta legend config,
    // NOT a per-invoice override — one sales point issues one legend type.
    // 'retencion' (mandatory): keeps CbteTipo 51/52/53, relabeled "Factura A
    // con leyenda OPERACIÓN SUJETA A RETENCIÓN". 'cbu_informada' (optional, no
    // withholding): ordinary CbteTipo 1/2/3 with "PAGO EN CBU INFORMADA" + a declared CBU.
    facturaMLegend?: 'retencion' | 'cbu_informada';
    // Declared CBU (22 digits), required when facturaMLegend === 'cbu_informada'.
    cbu?: string;
    // The store's DEDICATED CAEA punto de venta (RG 5782/2025 Art. 5) — always
    // DIFFERENT from `pointOfSale`, its own voucher sequence. Unset ⇒ the
    // invoice-time CAEA circuit breaker is skipped (degrade to pending_cae).
    caeaPointOfSale?: number;
    // The store's DEDICATED export punto de venta (WSFEX, "Comprobantes de
    // Exportación" system) — always DIFFERENT from `pointOfSale`/`caeaPointOfSale`.
    // Unset ⇒ export invoicing (Factura E) is unavailable for the store.
    exportPointOfSale?: number;
    // Cert expiry: ms-epoch of the cert's notAfter, parsed on read from the
    // stored PEM — never the bytes.
    certExpiry?: number;
    // Manual-only "I've completed the ARCA relación" toggles. WSFECRED (FCE
    // MiPyME) and WSCDC each need their own dedicated ARCA relación (+ MiPyME
    // cert for FCE); no auto-detection, never mutated by any AFIP-calling handler.
    fceEnabled?: boolean;
    wscdcEnabled?: boolean;
  }

  // Afip PATCH write shape

  /**
   * Write shape for the `afip` key of `PATCH /store`'s body. The wire accepts an
   * explicit `null` for these clearable keys — `null` deletes the key, omitting it
   * keeps the current value — but the read-side `Afip` interface can't express that
   * WRITE-ONLY null-clear semantic. Same convention as `MercadolibrePatchInput`'s
   * `defaultPosId`/`syncPolicy` null-knobs above.
   */
  interface AfipPatchInput {
    facturaMLegend?: 'retencion' | 'cbu_informada' | null;
    cbu?: string | null;
    iibbTransparency?: Afip['iibbTransparency'] | null;
    actividades?: number[] | null;
  }

  type StoreAttributeNames = keyof Store;

  interface Method {
    id: number;
    name: string;
    value?: number;
    removable?: boolean;
    editable?: boolean;
  }

  interface FiscalCondition {
    CbteTipo: {
      FAC: number;
      NC: number;
      ND: number;
      NVC: number;
      REC: number;
    };
    DocTipo: number;
    condFiscal: number;
    id: number;
    name: string;
  }

  // Non-blocking store warning surfaced on create/edit responses.
  // CUIT_SHARED: another store already uses this (normalized) CUIT — one CUIT
  // may own many stores (AFIP per-PtoVta), so it informs, never blocks.
  type StoreWarningCode = "CUIT_SHARED";

  interface StoreWarning {
    code: StoreWarningCode;
    stores: string[]; // other STO ids sharing the CUIT
  }

  // Cross-tenant store-config admin override

  /**
   * Request body for the MANAGER cross-tenant `PUT /platform/stores/{storeId}`
   * config+ecommerce override (Part A), mirroring the already-published
   * `SubscriptionAdminOverrideInput`. Merge-never-clobber on the BE:
   * nested `config`/`ecommerce` fields the payload omits are preserved.
   * Deliberately excludes credential-bearing integration fields (AFIP/MP) --
   * those stay owned by the tenant's own `PATCH /store` + OAuth flows.
   */
  interface StoreConfigAdminOverrideInput {
    config?: {
      priceDecimals?: 0 | 1 | 2 | 3;
      stock?: boolean;
      changePrice?: boolean;
      displayCurrency?: string;
      defaultProductCurrency?: string;
      defaultAccountCurrency?: string;
    };
    ecommerce?: Ecommerce;
    reason: string;
  }
}

export {}; // NOSONAR
