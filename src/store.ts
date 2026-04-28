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
      currency: number;
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
    currencies: Method[];
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
    mercadopago?: Mercadopago;
    // AFIP
    afip: Afip;
    // FROM CONFIG PK
    appVersion: number;
    fiscalConditions: FiscalCondition[];
    ivaTypes: Method[];
    minWithDni: number;
    notificationOptions?: Method[];
    // MAINTENANCE (see sinfactura/app#1126)
    maintenance?: MaintenanceInfo;
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

    // POINT OF SALE (api#879) — in-person QR via MP Point.
    pos?: {
      defaultDeviceId?: string;    // selected POS terminal id.
      defaultStoreMpId?: string;   // MP's store_id for multi-branch merchants.
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
