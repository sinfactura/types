declare global {
    interface AiUsageReport {
        from: string;
        to: string;
        totalUsd: number;
        budget: {
            globalDailyCeilingUsd: number;
            tenantDailyCeilingUsd: number;
        };
        peakDailyUtilizationPct: number;
        byFeature: Array<{
            featureKey: string;
            costUsd: number;
        }>;
        byModel: Array<{
            model: string;
            costUsd: number;
        }>;
        byTenant: Array<{
            storeId: string;
            costUsd: number;
        }>;
        byFeatureModel: Array<{
            featureKey: string;
            model: string;
            costUsd: number;
        }>;
        byDay: Array<{
            dated: string;
            costUsd: number;
            utilizationPct: number;
        }>;
    }
}
export {};
