declare global {
  interface Config {
    // PK // global config
    appVersion: number;
    fiscalConditions: FiscalCondition[];
    ivaTypes: Method[];
    minWithDni: number;
    notificationOptions: {
      id: string;
      name: string;
    }[];
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
    name: string;
    address: {
      street: string;
      postalCode: string;
      city: string;
      province: string;
    };
    cuit: string;
    phone: number;
    email: string;
    // CONFIG // NOT FEATURE FLAGS // FUNCTIONAL CONFIG
    config: {
      priceDecimals: 0 | 1 | 2 | 3;
      stock: boolean;
      changePrice: boolean;
      /**
       * @deprecated since app#1539 — alias of `displayCurrency`. Kept
       * during the migration so unmigrated readers stay correct.
       * Removed once every FE read-site has switched to
       * `displayCurrency`.
       */
      currency: string;
      /**
       * Back-office display currency (catalogId). The single currency
       * the operator's screens are framed in — distinct from the
       * currency of any individual money entity (Order / Invoice /
       * etc carry their own self-describing `currency` stamps).
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
    // ECOMMERCE
    ecommerce?: Ecommerce;
    // HANDLE IMAGES
    photoURL: string;
    photoData?: string;
    newPhotoURL?: string;
    removePhotoURL?: string;
    // GENERAL
    // api#942 — catalog references with per-tenant value + autoUpdate
    // overrides. Was `Method[]` (free-text name + integer id).
    currencies: StoreCurrencySubscription[];
    cashInMethods: Method[];
    cashOutMethods: Method[];
    debitMethods: Method[];
    // CUSTOMERS
    priceLists: Method[];
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
    // api#941 — tenant-controlled FX auto-update bindings. When
    // `enabled: true`, the platform's FX poller (propagate-fx worker)
    // fans out to this store and applies each binding's strategy
    // against the matching `currencies[i].value`. Bindings keyed by
    // (catalogId, sourceId).
    fxAutoUpdate?: StoreFxAutoUpdate;
    appVersion: number;
    fiscalConditions: FiscalCondition[];
    ivaTypes: Method[];
    minWithDni: number;
    notificationOptions?: Method[];
    maintenance?: MaintenanceInfo;
    legacyCurrencyIds?: Record<number, string>;
  }

  interface StoreIntegrations {
    afip?: Afip;
    mercadopago?: Mercadopago;
  }

  // ─────────────────────────────────────────────────────────────────
  // FX auto-update bindings (epic api#941)
  // ─────────────────────────────────────────────────────────────────

  // How a binding should react when the platform observes a fresh
  // rate for the bound (isoCode, variant):
  //   - 'overwrite'           — always rewrite store.currencies[i].value
  //   - 'overwrite-if-stale'  — only rewrite if the binding's
  //                             lastUpdatedAt is older than the source's
  //                             configured maxStaleness
  //   - 'notify-only'         — never touch currencies; just emit an
  //                             audit entry + WS broadcast so the FE
  //                             can surface a banner
  type FxAutoUpdateStrategy = "overwrite" | "overwrite-if-stale" | "notify-only";

  // Single auto-update binding. Pairs a catalog row with the source
  // and refresh policy the tenant wants. `lastUpdatedAt` and
  // `lastValue` are stamped server-side by propagate-fx; FE writers
  // omit them when creating/editing.
  interface FxAutoUpdateBinding {
    catalogId: string; // FK to PlatformCurrency
    sourceId: string; // PLATFORM/FX_SOURCES.sources[].id
    strategy: FxAutoUpdateStrategy;
    lastUpdatedAt?: number; // unix ms — set by propagate-fx worker
    lastValue?: number; // last value the worker observed
  }

  // Top-level FX auto-update config on `Store`. `enabled: false`
  // disables every binding without losing the configuration.
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

    // POINT OF SALE (api#885) — in-person QR via MP Point devices
    // (Smart 1/2 hardware terminals). Distinct from `staticQr` below
    // — Point uses a connected device that displays per-transaction
    // dynamic QRs; static QR is a printable image with no hardware.
    pos?: {
      defaultDeviceId?: string; // selected POS terminal id.
      defaultStoreMpId?: string; // MP's store_id for multi-branch merchants.
    };

    // STATIC QR (api#879) — over-the-counter scan-to-pay. Cached MP
    // POS row that owns the tenant's permanent QR image
    // (`qr.image` / `qr.template_image`). Re-generation hits a fast
    // path via `posId` lookup; recovery via `external_id` if the
    // cached id is lost. The `external_id` is pinned by the BE to a
    // deterministic `SF-${storeId}` so the linkage survives both
    // backups and operator-driven POS edits in the MP dashboard.
    staticQr?: {
      posId: string; // MP-issued POS numeric id (stringified).
      externalPosId: string; // SINFACTURA-pinned external id (`SF-{storeId}`).
      createdAt: number; // unix ms when the POS was created.
    };

    // DYNAMIC QR (api#884) — per-transaction amount-bound QR generated
    // via MP's Order API (`PUT /instore/orders/qr/.../qrs`) on a sibling
    // POS row pinned to `external_id: SF{storeId}DYN`, `fixed_amount: true`.
    // Distinct from `staticQr` above — that POS is `fixed_amount: false`
    // (variable-amount over-the-counter), this one is bound to single-use
    // transactions with the amount embedded.
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
}

export {}; // NOSONAR