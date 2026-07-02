declare global {
    interface Config {
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
            showDefaultPriceList?: number;
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
        acknowledgedSharedCuit?: boolean;
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
        photoURL: string;
        photoData?: string;
        newPhotoURL?: string;
        removePhotoURL?: string;
        mercadopagoUserId?: string;
        currencies: StoreCurrencySubscription[];
        cashInMethods: Method[];
        cashOutMethods: Method[];
        debitMethods: Method[];
        priceLists: PriceList[];
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
        minWithDni: number;
        maintenance?: MaintenanceInfo;
        legacyCurrencyIds?: Record<number, string>;
        afipCertAlert?: {
            expiry: number;
            band: 'expired' | '14' | '30' | '60';
        };
        emailSender?: {
            from?: string;
            verified?: boolean;
        };
    }
    interface StoreIntegrations {
        afip?: Afip;
        mercadopago?: Mercadopago;
        whatsapp?: WhatsAppConfig;
        sms?: SmsIntegration;
        gmail?: Gmail;
    }
    interface SmsIntegration {
        /** When true, the store may send SMS through the shared platform account. */
        enabled?: boolean;
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
        accessTokenEncrypted?: string;
        accessTokenExpiresAt?: number;
    }
    type FxAutoUpdateStrategy = "overwrite" | "overwrite-if-stale" | "notify-only";
    interface FxAutoUpdateBinding {
        catalogId: string;
        sourceId: string;
        strategy: FxAutoUpdateStrategy;
        lastUpdatedAt?: number;
        lastValue?: number;
    }
    interface StoreFxAutoUpdate {
        enabled: boolean;
        bindings: FxAutoUpdateBinding[];
    }
    interface Mercadopago {
        userId?: string;
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
        connectedAt?: number;
        tokenType?: string;
        scope?: string;
        liveMode?: boolean;
        publicKey?: string;
        status?: MercadopagoConnectionStatus;
        disconnectedAt?: number;
        lastTokenRefreshAt?: number;
        tokenRefreshFailures?: number;
        statementDescriptor?: string;
        notificationUrl?: string;
        pos?: {
            defaultDeviceId?: string;
            defaultStoreMpId?: string;
        };
        staticQr?: {
            posId: string;
            externalPosId: string;
            createdAt: number;
        };
        dynamicQrPos?: {
            posId: string;
            externalPosId: string;
            createdAt: number;
        };
        features?: {
            checkoutPro?: boolean;
            pointOfSale?: boolean;
            subscriptions?: boolean;
        };
        code?: string;
    }
    type MercadopagoConnectionStatus = "connected" | "expired" | "disconnected" | "error" | "never";
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
        pointOfSale?: number;
        activitiesStartedAt?: number;
        invoiceNote?: string;
        showInvoiceLogo?: string;
        currency: CatalogId;
        cert?: string;
        csr?: string;
        key?: string;
        accessTicket_EB?: string;
        accessTicket_RSF?: string;
        hasCert?: boolean;
        hasKey?: boolean;
        facturaMLegend?: 'retencion' | 'cbu_informada';
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
    type StoreWarningCode = "CUIT_SHARED";
    interface StoreWarning {
        code: StoreWarningCode;
        stores: string[];
    }
}
export {};
