declare global {
	// ───────────────────────────────────────────────────────────────
	// Platform-managed currency catalog (epic api#942)
	// ───────────────────────────────────────────────────────────────

	// Canonical catalogIds — the seeded set in api's
	// `stacks/services/currencyCatalog.ts:PLATFORM_CURRENCY_CATALOG`.
	// Adding a new platform-managed currency requires releasing a new
	// sinfactura-types version with the id appended here.
	//
	// Narrowed from `string` in types#63 so comparisons against AFIP
	// wire codes (`'PES'`/`'DOL'`) or other non-catalog literals fail
	// at compile time — surfaced by the always-false `afip.currency ===
	// 'PES'` regression caught in app#1576 (`ButtonInvoice`).
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

	// Variant of an isoCode currency. Disambiguates Argentine USD types
	// (oficial / blue / MEP / CCL / turista / informal) plus reserved
	// slots for crypto and BCRA reference rates.
	type CurrencyVariant =
		| "oficial"
		| "blue"
		| "mep"
		| "ccl"
		| "turista"
		| "informal"
		| "cripto"
		| "oficial-bcra";

	// Single row in PLATFORM/CURRENCY — managed by SUPER admins. Every
	// per-tenant `StoreCurrencySubscription` references one of these
	// by catalogId. Tenants cannot create or rename catalog rows; the
	// catalog is the platform's source of truth for
	// {isoCode, variant, displayName, afipCode}.
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

	// Per-tenant subscription to a catalog entry. Lives on the STORE
	// row under `currencies[]`. Tenants control `value` (the FX rate)
	// and `order` (display position). Auto-update bindings live in
	// `Store.fxAutoUpdate.bindings[]` (top-level), keyed by `catalogId`
	// — see `StoreFxAutoUpdate` in `./store.ts`.
	interface StoreCurrencySubscription {
		catalogId: string; // FK to PlatformCurrency
		value: number; // ARS-per-unit; auto-updated when bound (api#941)
		order?: number; // display ordering on the FE
	}

	// Wire shape for `GET /store` and `GET /currencies` — denormalized
	// catalog projection so the FE can render display strings without
	// a separate catalog fetch. BE projects on read; never stored.
	interface StoreCurrencySubscriptionView extends StoreCurrencySubscription {
		isoCode: string;
		variant: CurrencyVariant;
		displayName: string;
		afipCode?: "PES" | "DOL" | null;
		decimals?: number;
	}

	// Time-series sample written to the keyed CURRENCY partition by
	// the FX pollers (api#941). Each sample is one observation of one
	// catalog entry's rate at a point in time.
	//   PK: CURRENCY#${isoCode}#${variant}    SK: ${createdAt}
	// Renamed from `currencyId` to `catalogId` (api#942) — the field
	// is now an FK to PlatformCurrency, not a tenant-local integer.
	interface Currency {
		catalogId: string; // FK to PlatformCurrency
		dated: string;
		value: number;
		source?: string; // 'ambito' | 'dolarapi' | 'bluelytics' | 'bcra' (api#941)
	}

	// ───────────────────────────────────────────────────────────────
	// Platform FX-source registry (api#941 / api#1019)
	// ───────────────────────────────────────────────────────────────

	// Tenant-readable FX source — wire shape for GET /currencies?mode=fx-sources (api#941 / api#1019).
	// Already enabled-filtered server-side, so `enabled` is NOT on the wire (only enabled sources are returned).
	type FxProvider = "ambito" | "dolarapi" | "bluelytics" | "bcra";

	interface PlatformFxSource {
		/** Stable identifier — referenced by `Store.fxAutoUpdate.bindings[].sourceId`. */
		id: string;
		isoCode: string; // ISO 4217 (3 uppercase letters)
		variant: CurrencyVariant;
		provider: FxProvider;
	}

	// SUPER projection of an FX source — full persisted shape plus operational status
	// fields and the server-derived `isStale`. Returned (per source) by
	// GET /platform/fx-sources (api#1019 / api#1020 phase 3). Tenant `PlatformFxSource` is a strict subset.
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

	// Full PLATFORM/FX_SOURCES singleton — what GET /platform/fx-sources returns (api#941).
	// `maxStaleness` is row-level: per-source override (keyed by source id) with a `default` fallback.
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