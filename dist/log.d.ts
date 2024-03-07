declare global {
    interface Log {
        storeId: string;
        logId: string;
        createdAt: number;
        dated: number;
        mode?: string;
        userId?: string;
        customerId?: string;
        fullName?: string;
        url: string;
        details?: string;
        moreDetails?: string;
        ip: string;
        action?: string;
        screenType?: 'mobile' | 'tablet' | 'desktop';
        screenSize?: number;
        appVersion?: number;
    }
}
export {};
