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

  interface FeatureFlags {
    navbar?: {
      show?: boolean;
    };
    sidebar?: {
      show?: boolean;
      customerFinder?: {
        show?: boolean;
        showPicture?: boolean;
        showEditButton?: boolean;
        showStatsButton?: boolean;
        showExitButton?: boolean;
        showBalance?: boolean;
        showPaymentButton?: boolean;
      };
      showHome?: boolean;
      showCash?: boolean;
      showOrders?: boolean;
      showInvoices?: boolean;
      showBaskets?: boolean;
      showCustomers?: boolean;
      showProducts?: boolean;
      showReports?: boolean;
      store?: {
        show?: boolean;
        showConfig?: boolean;
        showCategories?: boolean;
        showBrands?: boolean;
        showProviders?: boolean;
        showUsers?: boolean;
        showIntegrations?: boolean;
      };
      showBalance?: boolean;
    };
    footer?: {
      desktopNavigation?: {
        show?: boolean;
        showCopyright?: boolean;
        showPrivacy?: boolean;
        showAppVersion?: boolean;
      };
      mobileNavigation?: {
        show?: boolean;
        showOrders?: boolean;
        showInvoices?: boolean;
        showBasket?: boolean;
        showFavorites?: boolean;
      };
    };
  }

  interface Store {
    storeId: string;
    createdAt: number;
    // Tenant kind (sinfactura/app#1054). Absent / 'production' = real tenant;
    // 'demo' = AI-seeded demo environment. Optional + backward-compatible.
    type?: 'production' | 'demo';
    name: string;
    address: {
      street: string;
      postalCode: string;
      city: string;
      province: string;
    };
    cuit: string;
    phone: string;
    email: string;
    acknowledgedSharedCuit?: boolean; // api#1328 — recorded when registered past the shared-CUIT gate
    // CONFIG // NOT FEATURE FLAGS // FUNCTIONAL CONFIG
    config: {
      priceDecimals: 0 | 1 | 2 | 3;
      stock: boolean;
      changePrice: boolean;
      /**
       * Back-office display currency (catalogId). The single currency
       * the operator's screens are framed in — distinct from the
       * currency of any individual money entity (Order / Invoice /
       * etc carry their own self-describing `currency` stamps).
       *
       * NOTE: the self-describing-stamp invariant is true for Order /
       * Invoice but only ASPIRATIONAL for ACCOUNT — `Account.currency`
       * is optional and ≈100% of historical rows are unstamped, so they
       * fall back to THIS field for their denomination (tracked
       * api#1333 / api#1352).
       */
      displayCurrency?: string;
      /**
       * Seed catalogId for new Product writes. Used by the FE product
       * form to populate the currency selector default — does NOT
       * reinterpret existing Product rows.
       */
      defaultProductCurrency?: string;
      /**
       * Seed catalogId for new Account / SupplierAccount writes. Used
       * by the FE cuenta form to populate the currency selector
       * default — does NOT reinterpret existing Account rows.
       */
      defaultAccountCurrency?: string;
    };
    features: FeatureFlags;
    ecommerce?: Ecommerce;
    // HANDLE IMAGES
    photoURL: string;
    photoData?: string;
    newPhotoURL?: string;
    removePhotoURL?: string;
    // STORE row reverse-lookup by tenant MP user_id — hot path for the
    // per-tenant payment webhook. Sparse: only STORE rows with an
    // active MP OAuth connection carry `mercadopagoUserId` (set by the
    // callback handler, removed by disconnect). KEYS_ONLY because a
    // follow-up Get fetches the full row including the access token.
    mercadopagoUserId?: string;
    // STORE row reverse-lookup by tenant ML seller user_id — hot path for
    // the unsigned-webhook tenant resolution (api#1573). Sparse mirror of
    // `integrations.mercadolibre.userId` (DDB GSIs can't index nested
    // attributes): only STORE rows with an active ML OAuth connection
    // carry it (set by the callback handler, removed atomically with the
    // leaf by disconnect). Feeds the KEYS_ONLY `mercadolibreUserId-PK` GSI.
    mercadolibreUserId?: string;
    currencies: StoreCurrencySubscription[];
    cashInMethods: Method[];
    cashOutMethods: Method[];
    debitMethods: Method[];
    // CUSTOMERS
    priceLists: PriceList[]; // was Method[] — PriceList ⊇ Method, so type-compatible (#1780)
    accountMethods: Method[];
    deliveryMethods: Method[];
    paymentMethods: Method[];
    // PRODUCTS
    brands: Brand[];
    categories: Category[];
    // COLORS
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
    minWithDni: number;
    maintenance?: MaintenanceInfo;
    // api#1382 — last cert-expiry alert fired for the current cert, so the daily cron
    // doesn't re-alert within a band. Keyed to the cert's expiry ms so a renewed cert
    // (new expiry) auto-resets.
    afipCertAlert?: {
      expiry: number;
      band: 'expired' | '14' | '30' | '60';
    };
    // api#1401 — white-label transactional-email sender. `from` is the store's own
    // envelope sender; `verified` is BE-set only after its SES identity is confirmed.
    // Distinct from the existing `email` contact string.
    emailSender?: {
      from?: string;
      verified?: boolean;
    };
    // api#1567 — pre-launch landing lead-capture marker. Set at registration
    // when `waitlist: true` is sent on `POST /auth?mode=register`; cleared by
    // the `POST /platform/operations { mode: 'convert-waitlist' }` operator
    // endpoint (which also fires the deferred welcome email).
    waitlist?: boolean;
  }

  interface StoreIntegrations {
    afip?: Afip;
    mercadopago?: Mercadopago;
    // Per-tenant WhatsApp Business connection (sinfactura/app#1072).
    whatsapp?: WhatsAppConfig;
    // Per-store SMS entitlement (api#1400). The smsmasivos account is shared
    // platform-wide; this flag gates whether a store may consume it. Future
    // SMS-pack metering (balance, packId, monthlyLimit) extends this blob.
    sms?: SmsIntegration;
    // Per-tenant Gmail OAuth send connection (app#1270) — gmail.send scope only.
    gmail?: Gmail;
    // Per-tenant MercadoLibre seller connection (app#797 / api#1572).
    mercadolibre?: Mercadolibre;
  }

  interface SmsIntegration {
    /** When true, the store may send SMS through the shared platform account. */
    enabled?: boolean;
    // api#1515 — per-store SMS signature (firma) appended to outbound order SMS
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
    /** Lifecycle fields (api#1459 / #1460). */
    status?: 'connected' | 'expired' | 'disconnected' | 'error' | 'never';
    disconnectedAt?: number;
    lastTokenRefreshAt?: number;
    tokenRefreshFailures?: number;
    // api#1457 — lazily-refreshed access-token cache for the Gmail send path,
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
    // OAUTH CONNECTION (api#875) — set by /mercadopago/oauth/callback.
    userId?: string; // MP user_id; string for precision safety.
    accessToken?: string; // V1 plaintext; KMS-encrypted in api#881.
    refreshToken?: string; // V1 plaintext; KMS-encrypted in api#881.
    expiresAt?: number; // unix ms when accessToken expires.
    connectedAt?: number; // unix ms when OAuth flow completed.
    tokenType?: string; // 'bearer'.
    scope?: string; // granted scopes, e.g. 'offline_access read write'.
    liveMode?: boolean; // true when connected to MP production credentials.
    publicKey?: string; // MP public key — safe to expose to the FE for SDK use.

    // STATUS / OPS (api#876, api#877) — written by refresh + disconnect.
    status?: MercadopagoConnectionStatus;
    disconnectedAt?: number; // unix ms; admin-triggered disconnect.
    lastTokenRefreshAt?: number;
    tokenRefreshFailures?: number;

    // PER-STORE CONFIG (api#878+) — admin-controlled from Integrations hub.
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

    // FEATURE TOGGLES per store, surfaced in the FE Integrations hub.
    features?: {
      checkoutPro?: boolean; // online payments via Checkout Pro.
      pointOfSale?: boolean; // in-person QR / Point.
      subscriptions?: boolean; // recurring billing (future).
    };

    // LEGACY (sinfactura/app#1244) — pre-OAuth FE-issued field, kept for
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
    // OAUTH CONNECTION (api#1572) — set by /mercadolibre/oauth/callback.
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

    // PER-STORE CONFIG (api#1576 / api#1575) — admin-controlled from the
    // Integrations hub Configuración tab.
    /** Per-channel auto-invoice toggle — default OFF; enabling requires
     * `defaultPosId` (dedicated PdV) + the Facturador-collision check. */
    autoInvoice?: boolean;
    defaultPosId?: number; // dedicated AFIP PdV for the ML channel.
    // Outbound stock-sync knobs, applied in order: buffer → limit → pause
    // (industry-convergent; persisted via diff-PATCH from app#1256).
    syncPolicy?: {
      stockBuffer?: number; // subtract from local stock before publishing.
      stockLimit?: number; // hard cap on published stock.
      paused?: boolean; // pause ALL outbound sync (inbound keeps flowing).
    };
  }

  interface Afip {
    production: boolean;
    // ADDRESS
    address?: string;
    city?: string;
    condFiscal?: number;
    cuit?: string;
    condFiscalName?: string;
    postalCode?: string;
    province?: string;
    razonSocial?: string;
    // NEW
    pointOfSale?: number; // PTO_VTA
    activitiesStartedAt?: number; // INICIO_ACTIVIDADES
    invoiceNote?: string; // NOTA EN FACTURA
    showInvoiceLogo?: string; // logo en factura
    // catalogId (api#942) — FK to PlatformCurrency. The AFIP MonId
    // projection (`'PES' | 'DOL'`) is derived at invoice-write time from
    // `PlatformCurrency.afipCode` of the referenced catalog row. Was
    // `1 | 2` (legacy tenant-local Method ids; 1=PESOS, 2=DOLARES).
    // The matching `StoreCurrencySubscription.value` provides the AFIP
    // `MonCotiz` exchange rate.
    //
    // Narrowed to `CatalogId` in types#63 — readers comparing this
    // against `'PES'` / `'DOL'` (AFIP wire codes) now fail at compile
    // time. Wire boundary callers receiving DDB rows can keep using
    // `as CatalogId` once the BE schema validation lands (api companion
    // PR — `afipSchema.currency` validated against `currencyCatalogIdSchema`).
    currency: CatalogId;
    // ACCESS
    cert?: string;
    csr?: string;
    key?: string;
    accessTicket_EB?: string;
    accessTicket_RSF?: string;
    // api#1557 — WSAA ticket for the 'wsfex' service (export invoicing); per-service, 12h TTL.
    accessTicket_FEX?: string;
    // api#1558 — WSAA ticket for the 'wsfecred' service (FCE MiPyME buyer-side ops); per-service, 12h TTL.
    accessTicket_FECRED?: string;
    // api#1500 — WSAA ticket for the 'wscdc' service (third-party voucher constatación); per-service, 12h TTL.
    accessTicket_CDC?: string;
    // Derived read-only flags (api#1318): cert/key existence, projected on read — never the bytes.
    hasCert?: boolean;
    hasKey?: boolean;
    // RG 5762/2025 Factura M elimination (api#1560). Per-punto-de-venta
    // legend config -- NOT a per-invoice override; one sales point issues
    // one legend type. Absent/undefined means the store never issued
    // Factura M and this doesn't apply.
    // 'retencion' (mandatory replacement path): keeps CbteTipo 51/52/53,
    // relabeled "Factura A con leyenda OPERACIÓN SUJETA A RETENCIÓN".
    // 'cbu_informada' (optional, no withholding): ordinary CbteTipo 1/2/3
    // with the "PAGO EN CBU INFORMADA" legend + a declared CBU.
    facturaMLegend?: 'retencion' | 'cbu_informada';
    // api#1560 — the punto-de-venta's declared CBU (Clave Bancaria Uniforme,
    // 22 digits), required when facturaMLegend === 'cbu_informada' (RG 5762
    // Art. 5's "PAGO EN CBU INFORMADA" variant).
    cbu?: string;
    // api#1586 — the store's DEDICATED CAEA punto de venta. RG 5782/2025
    // Art. 5 mandates "puntos de venta específicos" for CAEA (the ARCA ABM
    // binds each PtoVta number to one Sistema — "CAEA – Fact. Elect." is
    // distinct from the CAE web-services type), so this is always a
    // DIFFERENT number than `pointOfSale`, with its own voucher sequence.
    // Unset ⇒ the invoice-time CAEA circuit breaker is skipped (degrade to
    // pending_cae) and zero-movement reporting is held.
    caeaPointOfSale?: number;
    // api#1557 — the store's DEDICATED export punto de venta (WSFEX). ARCA
    // only accepts PtoVtas registered under Sistema "Comprobantes de
    // Exportación - Web Services" (FEEWS, err 1510) — always a DIFFERENT
    // number than `pointOfSale`/`caeaPointOfSale`, with its own voucher
    // sequence. Unset ⇒ export invoicing (Factura E) is unavailable for the
    // store.
    exportPointOfSale?: number;
    // Cert expiry (api#1374): ms-epoch of the cert's notAfter, parsed on read
    // from the stored PEM by the api's sanitizeStoreRow — never the bytes.
    certExpiry?: number;
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

  // Non-blocking store warning surfaced on create/edit responses (api#1276).
  // CUIT_SHARED: another store already uses this (normalized) CUIT — one CUIT
  // may own many stores (AFIP per-PtoVta), so it informs, never blocks.
  type StoreWarningCode = "CUIT_SHARED";

  interface StoreWarning {
    code: StoreWarningCode;
    stores: string[]; // other STO ids sharing the CUIT
  }
}

export {}; // NOSONAR
