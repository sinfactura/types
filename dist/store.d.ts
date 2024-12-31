declare global {
    interface Config {
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
        config: {
            priceDecimals: 0 | 1 | 2 | 3;
            stock: boolean;
            changePrice: boolean;
            currency: number;
        };
        features: FeatureFlags;
        ecommerce?: Ecommerce;
        photoURL: string;
        photoData?: string;
        newPhotoURL?: string;
        removePhotoURL?: string;
        currencies: Method[];
        cashInMethods: Method[];
        cashOutMethods: Method[];
        debitMethods: Method[];
        priceLists: Method[];
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
        mercadopago?: {
            accessToken?: string;
            code?: string;
            refreshToken?: string;
        };
        afip: Afip;
        appVersion: number;
        fiscalConditions: FiscalCondition[];
        ivaTypes: Method[];
        minWithDni: number;
        notificationOptions?: Method[];
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
        pointOfSale?: number;
        activitiesStartedAt?: number;
        invoiceNote?: string;
        showInvoiceLogo?: string;
        currency: 1 | 2;
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
    interface Category {
        categoryId: string;
        name: string;
        photoURL?: string;
        photoData?: string;
        removePhotoURL?: string;
        isFather?: boolean;
        father?: number;
        disabled?: boolean;
        isNew?: boolean;
    }
    interface Brand {
        brandId: string;
        name: string;
        photoURL?: string;
        photoData?: string;
        removePhotoURL?: string;
        isFather?: boolean;
        father?: number;
        disabled?: boolean;
        isNew?: boolean;
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
