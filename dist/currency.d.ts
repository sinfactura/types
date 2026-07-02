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
    type FxProvider = "ambito" | "dolarapi" | "bluelytics" | "bcra";
    interface PlatformFxSource {
        /** Stable identifier — referenced by `Store.fxAutoUpdate.bindings[].sourceId`. */
        id: string;
        isoCode: string;
        variant: CurrencyVariant;
        provider: FxProvider;
    }
    interface PlatformFxSourceWithStatus extends PlatformFxSource {
        enabled: boolean;
        /** EventBridge cron expression (`minute hour day month weekday`). */
        cron: string;
        /** Optional override for the provider's source URL. */
        sourceUrl?: string;
        /** Unix ms of the last successful fetch. Undefined if never succeeded. */
        lastSuccessAt?: number;
        /** Unix ms of the last failed fetch. Undefined if no failures yet. */
        lastFailureAt?: number;
        /** Short reason for the most recent failure (truncated to 256 chars). */
        lastFailureReason?: string;
        /** Consecutive-failure streak; resets on first success. Drives failover (>=3) + alerts. */
        consecutiveFailures?: number;
        /** Sibling source id to attempt when `consecutiveFailures` crosses the failover threshold. */
        fallbackSourceId?: string;
        /** Server-derived: `now - lastSuccessAt > maxStaleness`. Added by the SUPER GET handler. */
        isStale: boolean;
    }
    interface PlatformFxSourcesRow {
        enabled: boolean;
        sources: PlatformFxSourceWithStatus[];
        maxStaleness: {
            default: number;
        } & Record<string, number>;
        updatedAt: number;
        /** `true` once an explicit row is persisted; `false` when the handler is returning DEFAULT_FX_SOURCES. */
        persisted?: boolean;
    }
}
export {};
