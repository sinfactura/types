declare global {
    interface Supplier {
        storeId: string;
        userId: string;
        supplierId: string;
        createdAt: number;
        photoURL: string;
        company: string;
        cuit: string;
        razonSocial: string;
        contactName: string;
        phone: number;
        email: string;
        balance: number;
        currencyId: string;
        service: boolean;
        disabled: boolean;
    }
    interface SupplierInvoice {
        storeId: string;
        userId: string;
        invoiceId: string;
        supplierId: string;
        createdAt: number;
        type: 'FAC' | 'ND' | 'NC';
        dated: number;
        number: string;
        razonSocial: string;
        cuit: string;
        neto: number;
        iva10: number;
        iva21: number;
        total: number;
        per_iibb: number;
        per_iva: number;
        file: string;
        currency?: string;
        currencyValue: number;
        currencyValueAt?: number;
        search?: string;
    }
    interface SupplierAccount {
        storeId: string;
        userId: string;
        accountId: string;
        supplierId: string;
        createdAt: number;
        dated: number;
        fullName: string;
        subject: string;
        details: string;
        debit: number;
        credit: number;
        amount: number;
        currency?: string;
        currencyValue: number;
        currencyValueAt?: number;
        balance: number;
        deleted: boolean;
    }
}
export {};
