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
      // catalogId of the store's display currency (api#942). Was a
      // tenant-local integer; now an FK to PlatformCurrency.
      currency: string;
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
    /**
     * @deprecated api#890 — use `store.integrations.mercadopago`. This
     * top-level field is dual-written for one release window and removed
     * in the api#890 cleanup PR.
     */
    mercadopago?: Mercadopago;
    /**
     * @deprecated api#890 — use `store.integrations.afip`. This top-level
     * field is dual-written for one release window and removed in the
     * api#890 cleanup PR.
     */
    afip: Afip;
    // PER-TENANT INTEGRATIONS UMBRELLA (api#890) — single namespace for
    // every per-store integration blob. Populated by the dual-write code
    // path; backfilled for existing rows by the
    // `migrate-store-integrations` super endpoint. Optional during the
    // migration window so older rows still type-check.
    integrations?: StoreIntegrations;
    // FROM CONFIG PK
    appVersion: number;
    fiscalConditions: FiscalCondition[];
    ivaTypes: Method[];
    minWithDni: number;
    notificationOptions?: Method[];
    // MAINTENANCE (see sinfactura/app#1126)
    maintenance?: MaintenanceInfo;
    // api#942 — populated by the migrate-currency-catalog SUPER
    // endpoint. Maps legacy tenant-local integer ids to catalogIds so
    // existing `Product.currency: 1` etc. resolve during the
    // transition. Dropped once every reader consumes catalogId
    // directly (filed as a follow-up cleanup ticket).
    legacyCurrencyIds?: Record<number, string>;
  }

  // api#890 — Umbrella for every per-tenant integration blob. New
  // providers slot in here without growing the top-level Store namespace.
  // GSI keys (`mercadopagoUserId`) stay top-level — DynamoDB GSIs can't
  // index nested attributes — only the *config* moves under the umbrella.
  interface StoreIntegrations {
    afip?: Afip;
    mercadopago?: Mercadopago;
  }

  // Per-tenant MercadoPago integration (epic #832). Populated by the
  // backend OAuth Connect flow; mutated by token refresh, disconnect,
  // and admin-driven config changes from the FE Integrations hub.
  // Stored nested on the STORE row alongside the existing `afip` blob;
  // a future P1 refactor (filed as a follow-up to #832) will
  // consolidate every per-tenant integration under a single
  // `store.integrations.{provider}` umbrella.
  interface Mercadopago {
    // OAUTH CONNECTION (api#875) — set by /mercadopago/oauth/callback.
    userId?: string;            // MP user_id; string for precision safety.
    accessToken?: string;       // V1 plaintext; KMS-encrypted in api#881.
    refreshToken?: string;      // V1 plaintext; KMS-encrypted in api#881.
    expiresAt?: number;         // unix ms when accessToken expires.
    connectedAt?: number;       // unix ms when OAuth flow completed.
    tokenType?: string;         // 'bearer'.
    scope?: string;             // granted scopes, e.g. 'offline_access read write'.
    liveMode?: boolean;         // true when connected to MP production credentials.
    publicKey?: string;         // MP public key — safe to expose to the FE for SDK use.

    // STATUS / OPS (api#876, api#877) — written by refresh + disconnect.
    status?: MercadopagoConnectionStatus;
    disconnectedAt?: number;    // unix ms; admin-triggered disconnect.
    lastTokenRefreshAt?: number;
    tokenRefreshFailures?: number;

    // PER-STORE CONFIG (api#878+) — admin-controlled from Integrations hub.
    statementDescriptor?: string;  // shows on customer's bank statement.
    notificationUrl?: string;      // webhook URL registered with MP.

    // POINT OF SALE (api#885) — in-person QR via MP Point devices
    // (Smart 1/2 hardware terminals). Distinct from `staticQr` below
    // — Point uses a connected device that displays per-transaction
    // dynamic QRs; static QR is a printable image with no hardware.
    pos?: {
      defaultDeviceId?: string;    // selected POS terminal id.
      defaultStoreMpId?: string;   // MP's store_id for multi-branch merchants.
    };

    // STATIC QR (api#879) — over-the-counter scan-to-pay. Cached MP
    // POS row that owns the tenant's permanent QR image
    // (`qr.image` / `qr.template_image`). Re-generation hits a fast
    // path via `posId` lookup; recovery via `external_id` if the
    // cached id is lost. The `external_id` is pinned by the BE to a
    // deterministic `SF-${storeId}` so the linkage survives both
    // backups and operator-driven POS edits in the MP dashboard.
    staticQr?: {
      posId: string;             // MP-issued POS numeric id (stringified).
      externalPosId: string;     // SINFACTURA-pinned external id (`SF-{storeId}`).
      createdAt: number;         // unix ms when the POS was created.
    };

    // DYNAMIC QR (api#884) — per-transaction amount-bound QR generated
    // via MP's Order API (`PUT /instore/orders/qr/.../qrs`) on a sibling
    // POS row pinned to `external_id: SF{storeId}DYN`, `fixed_amount: true`.
    // Distinct from `staticQr` above — that POS is `fixed_amount: false`
    // (variable-amount over-the-counter), this one is bound to single-use
    // transactions with the amount embedded.
    dynamicQrPos?: {
      posId: string;             // MP-issued POS numeric id (stringified).
      externalPosId: string;     // SINFACTURA-pinned external id (`SF{storeId}DYN`).
      createdAt: number;         // unix ms when the POS was created.
    };

    // FEATURE TOGGLES per store, surfaced in the FE Integrations hub.
    features?: {
      checkoutPro?: boolean;       // online payments via Checkout Pro.
      pointOfSale?: boolean;       // in-person QR / Point.
      subscriptions?: boolean;     // recurring billing (future).
    };

    // LEGACY (sinfactura/app#1244) — pre-OAuth FE-issued field, kept for
    // backwards compat during migration; cleared after migration ships.
    code?: string;
  }

  type MercadopagoConnectionStatus =
    | "connected"
    | "expired"
    | "disconnected"
    | "error"
    | "never";

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
    currency: 1 | 2; // 1 PESOS, 2 DOLARES
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

export {};
