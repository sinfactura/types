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
    phone: string;
    email: string;
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
    fxAutoUpdate?: StoreFxAutoUpdate;
    appVersion: number;
    fiscalConditions: FiscalCondition[];
    ivaTypes: Method[];
    minWithDni: number;
    maintenance?: MaintenanceInfo;
    legacyCurrencyIds?: Record<number, string>;
  }

  interface StoreIntegrations {
    afip?: Afip;
    mercadopago?: Mercadopago;
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
    // Derived read-only flags (api#1318): cert/key existence, projected on read — never the bytes.
    hasCert?: boolean;
    hasKey?: boolean;
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
