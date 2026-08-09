declare global {
	// Canonical catalogIds — the seeded set in api's
	// `stacks/services/currencyCatalog.ts:PLATFORM_CURRENCY_CATALOG`. Narrowed
	// from `string` so comparisons against AFIP wire codes ('PES'/'DOL') fail
	// at compile time.
	type CatalogId =
		| "ars"
		| "usd-oficial"
		| "usd-blue"
		| "usd-mep"
		| "usd-ccl"
		| "usd-turista"
		| "usd-informal"
		| "usd-oficial-bcra"
		| "eur-oficial"
		| "brl-oficial";

	// Variant of an isoCode currency: disambiguates Argentine USD types
	// (oficial/blue/MEP/CCL/turista/informal) plus reserved slots for crypto
	// and BCRA reference rates.
	type CurrencyVariant =
		| "oficial"
		| "blue"
		| "mep"
		| "ccl"
		| "turista"
		| "informal"
		| "cripto"
		| "oficial-bcra";

	// Single row in PLATFORM/CURRENCY — managed by SUPER admins; the platform's
	// source of truth for {isoCode, variant, displayName, afipCode}. Tenants
	// cannot create or rename rows, only reference one via `catalogId`.
	interface PlatformCurrency {
		catalogId: string; // canonical id, e.g. 'usd-oficial'
		isoCode: string; // ISO 4217 (e.g. 'USD', 'ARS', 'EUR', 'BRL')
		variant: CurrencyVariant;
		displayName: string; // e.g. 'DOLAR OFICIAL'
		afipCode: "PES" | "DOL" | null; // null = not invoiceable via AFIP
		decimals: number; // display rounding hint
		enabled: boolean; // soft-disable a row globally
		createdAt: number;
		updatedAt?: number;
	}

	// Per-tenant subscription to a catalog entry, on the STORE row under
	// `currencies[]`. Auto-update bindings live in `Store.fxAutoUpdate.bindings[]`
	// (top-level), keyed by `catalogId` — see `StoreFxAutoUpdate` in `./store.ts`.
	interface StoreCurrencySubscription {
		catalogId: string; // FK to PlatformCurrency
		value: number; // ARS-per-unit; auto-updated when bound
		order?: number; // display ordering on the FE
	}

	// Wire shape for `GET /store` and `GET /currencies` — denormalized catalog
	// projection so the FE can render display strings without a separate fetch.
	// BE projects on read; never stored.
	interface StoreCurrencySubscriptionView extends StoreCurrencySubscription {
		isoCode: string;
		variant: CurrencyVariant;
		displayName: string;
		afipCode?: "PES" | "DOL" | null;
		decimals?: number;
	}

	// Time-series sample written to the keyed CURRENCY partition by the FX
	// pollers (PK: CURRENCY#${isoCode}#${variant}, SK: ${createdAt}). Carries no
	// catalog FK — the poller identifies the series by the PK, not by `catalogId`.
	// Mirrors the single writer verbatim (documentClient.put in
	// stacks/lambdas/fxPoller/_common.ts).
	interface Currency {
		createdAt: number; // Unix ms; also the SK
		dated: number; // YYYYMMDD, America/Argentina/Buenos_Aires (getDated())
		value: number;
		// Provider-supplied change indicator, stored verbatim (e.g. '+1,2%').
		// Absent when the provider reports none.
		variation?: string;
		source?: string; // 'ambito' | 'dolarapi' | 'bluelytics' | 'bcra'
		sourceId?: string; // FX-source registry id the sample came from
	}

	// ───────────────────────────────────────────────────────────────
	// Platform FX-source registry
	// ───────────────────────────────────────────────────────────────

	// Tenant-readable FX source — wire shape for GET /currencies?mode=fx-sources.
	// Already enabled-filtered server-side (only enabled sources are returned).
	type FxProvider = "ambito" | "dolarapi" | "bluelytics" | "bcra";

	interface PlatformFxSource {
		/** Stable identifier — referenced by `Store.fxAutoUpdate.bindings[].sourceId`. */
		id: string;
		isoCode: string; // ISO 4217 (3 uppercase letters)
		variant: CurrencyVariant;
		provider: FxProvider;
	}

	// SUPER projection of an FX source — full persisted shape plus operational
	// status fields and the server-derived `isStale`. Returned by
	// GET /platform/fx-sources. Tenant `PlatformFxSource` is a strict subset.
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

	// Full PLATFORM/FX_SOURCES singleton — what GET /platform/fx-sources returns.
	// `maxStaleness` is row-level: per-source override keyed by source id, with
	// a `default` fallback.
	interface PlatformFxSourcesRow {
		enabled: boolean;
		sources: PlatformFxSourceWithStatus[];
		maxStaleness: { default: number } & Record<string, number>;
		updatedAt: number;
		/** `true` once an explicit row is persisted; `false` when the handler is returning DEFAULT_FX_SOURCES. */
		persisted?: boolean;
	}
}

export {}; // NOSONAR