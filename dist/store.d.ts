declare global {
    interface Config {
        storeId: number;
        appVersion: number;
        fiscalConditions: FiscalCondition[];
        ivaTypes: Method[];
        notificationOptions: Method[];
        stats: {
            store: number;
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
        cuit: number;
        phone: number;
        email: string;
        config: {
            priceDecimals: 0 | 1 | 2 | 3;
            stock: boolean;
            changePrice: boolean;
            currency: number;
        };
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
        afip: {
            address?: string;
            city?: string;
            condFiscal?: number;
            cuit?: number;
            condFiscalName?: string;
            postalCode?: string;
            province?: string;
            razonSocial?: string;
            pointOfSale?: number;
            activitiesStartedAt?: number;
            invoiceNote?: string;
            showInvoiceLogo?: string;
            cert?: string;
            csr?: string;
            key?: string;
            accessTicket_EB?: string;
            accessTicket_RSF?: string;
        };
        appVersion: number;
        ivaTypes: Method[];
        fiscalConditions: FiscalCondition[];
        notificationOptions?: {
            id: string;
            name: string;
        }[];
        minWithDni: number;
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
        categoryId: number;
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
        brandId: number;
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
