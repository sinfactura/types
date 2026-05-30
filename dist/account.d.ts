declare global {
    interface Account {
        storeId: string;
        accountId: string;
        orderId?: string;
        createdAt: number;
        dated: number;
        customerId?: string;
        fullName?: string;
        subject?: string;
        details: string;
        debit?: number;
        credit?: number;
        amount?: number;
        currency?: string;
        currencyValue?: number;
        currencyValueAt?: number;
        balance?: number;
        userId: string;
        deleted?: boolean;
    }
}
export {};
