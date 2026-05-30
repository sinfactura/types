declare global {
    type CatalogId = "ars" | "usd-oficial" | "usd-blue" | "usd-mep" | "usd-ccl" | "usd-turista" | "usd-informal" | "usd-oficial-bcra" | "eur-oficial" | "brl-oficial";
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
