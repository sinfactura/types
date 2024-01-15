declare global {
    interface Log {
        storeId: string;
        logId: string;
        createdAt: number;
        dated: number;
        userId: string;
        customerId?: string;
        customerName?: string;
        url: string;
        details?: string;
        moreDetails?: string;
    }
}
export {};
