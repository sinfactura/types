declare global {
    interface Cash {
        storeId: string;
        cashId: string;
        createdAt: number;
        dated: number;
        description: string;
        income?: number;
        outcome?: number;
        balance?: number;
        subject?: string;
        currency?: string;
        currencyValue?: number;
        currencyValueAt?: number;
        balanceByCurrency?: Record<string, number>;
        incomeByCurrency?: Record<string, number>;
    }
}
export {};
