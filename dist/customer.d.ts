declare global {
    interface CustomerAfip {
        cuit: string;
        razonSocial: string;
        condFiscal: number;
        condFiscalName: string;
        address: string;
        postalCode: string;
        city: string;
        province: string;
    }
    interface CustomerMarketing {
        adds?: boolean;
        email?: boolean;
        phone?: boolean;
        sms?: boolean;
        whatsapp?: boolean;
    }
    interface Customer {
        storeId: string;
        customerId: string;
        address: string;
        afip: CustomerAfip[];
        balance?: number;
        city: string;
        createdAt: number;
        cuit: string;
        deliveryMethod: number;
        disabled: boolean;
        discount: number;
        email: string;
        favorites?: Partial<Product>[];
        fullName: string;
        hash?: string;
        lastBuy?: number;
        lastLog?: number;
        marketing?: CustomerMarketing;
        minBuy?: number;
        paymentMethod: number;
        phone: string;
        photoURL: string;
        photoData?: string;
        removePhotoURL?: string;
        postalCode: string;
        /**
         * FK to PriceList.id (NOT a positional ordinal). Picks which PriceSlot /
         * materialized priceN applies to this customer. Legacy values 1..4 already
         * equal the seeded list ids, so the migration is value-preserving; getPrice
         * resolves by id, not by `price${ordinal}`. (#1780 / types#88)
         */
        priceList: number;
        province: string;
        salt?: string;
        search: string;
        updatedAt?: number;
        /**
         * catalogId (api#942) — FK to PlatformCurrency.
         *
         * DISPLAY / PRICING preference only: which currency this customer
         * views and transacts in (load-bearing in storefront pricing + the
         * DNI/CUIT checkout gate). It is NOT a ledger denomination and is
         * pure passenger data server-side. MUST NOT be used to infer the
         * denomination of unstamped `ACCOUNT` rows — doing so is the root
         * cause of api#1333. Unstamped ledger rows fall back to
         * `store.config.displayCurrency`, never to this field.
         */
        currencyId?: string;
        deliveryAddress?: {
            fullName: string;
            address: string;
            phone: string;
            city: string;
            province: string;
            postalCode: string;
        };
    }
    interface AuthCustomer extends Customer {
        accessToken: string;
        refreshToken: string;
    }
}
export {};
