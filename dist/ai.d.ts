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
    type ProductEnrichField = 'name' | 'description' | 'seo' | 'attributes' | 'classification';
    type ProductEnrichTone = 'neutro y profesional' | 'formal' | 'cercano y amigable' | 'técnico y directo' | 'entusiasta y persuasivo';
    interface ProductEnrichRequest {
        productId: string;
        fields?: ProductEnrichField[];
        tone?: ProductEnrichTone;
        regenerate?: boolean;
    }
    interface ProductEnrichAttribute {
        name: string;
        value: string;
        evidence: string;
    }
    interface ProductEnrichClassification {
        categoryId: string | null;
        brandId: string | null;
        evidence: string;
    }
    interface ProductEnrichSuggestion {
        name?: string;
        description?: string;
        seoTitle?: string;
        seoDescription?: string;
        attributes?: ProductEnrichAttribute[];
        classification?: ProductEnrichClassification;
    }
    interface ProductEnrichResponse {
        suggestion: ProductEnrichSuggestion;
        model: string;
        cached: boolean;
    }
}
export {};
