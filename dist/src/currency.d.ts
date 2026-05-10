declare global {
    type CurrencyVariant = "oficial" | "blue" | "mep" | "ccl" | "turista" | "informal" | "cripto" | "oficial-bcra";
    interface PlatformCurrency {
        catalogId: string;
        isoCode: string;
        variant: CurrencyVariant;
        displayName: string;
        afipCode: "PES" | "DOL" | null;
        decimals: number;
        enabled: boolean;
        createdAt: number;
        updatedAt?: number;
    }
    interface StoreCurrencySubscription {
        catalogId: string;
        value: number;
        order?: number;
        autoUpdate?: {
            sourceId: string;
            strategy: "overwrite" | "overwrite-if-stale" | "notify-only";
            lastUpdatedAt?: number;
            lastValue?: number;
        };
    }
    interface StoreCurrencySubscriptionView extends StoreCurrencySubscription {
        isoCode: string;
        variant: CurrencyVariant;
        displayName: string;
        afipCode?: "PES" | "DOL" | null;
        decimals?: number;
    }
    interface Currency {
        catalogId: string;
        dated: string;
        value: number;
        source?: string;
    }
}
export {};
