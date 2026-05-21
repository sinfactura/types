declare global {
	// ───────────────────────────────────────────────────────────────
	// Platform-managed currency catalog (epic api#942)
	// ───────────────────────────────────────────────────────────────

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
}

export {}; // NOSONAR