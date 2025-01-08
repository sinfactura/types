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
        postalCode: string;
        priceList: number;
        province: string;
        salt?: string;
        search: string;
        updatedAt?: number;
    }
    interface AuthCustomer extends Customer {
        accessToken: string;
        refreshToken: string;
    }
}
export {};
