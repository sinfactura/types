declare global {
    interface Supplier {
        storeId: string;
        supplierId: string;
        company: string;
        cuit: number;
        razonSocial: string;
        contactName: string;
        phone: number;
        email: string;
        balance: number;
        currencyId: number;
        service: boolean;
        disabled: boolean;
    }
}
export {};
