// AI platform-spend contracts (MANAGER dashboard).

declare global {
	// Wire shape of `GET /platform/ai-usage` (managerToken). Aggregated from the
	// AI cost-meter rows — every field is always present (the `by*`
	// arrays are empty, never absent, on no data).
	//
	// - `from` / `to` echo the queried range as `YYYYMMDD` (Buenos Aires dating),
	//   NOT ISO dates.
	// - `costUsd` / `totalUsd` are raw platform USD, server-rounded to 6 dp.
	// - `budget` echoes the configured daily ceilings; `utilizationPct` /
	//   `peakDailyUtilizationPct` are day-spend against the GLOBAL daily ceiling
	//   (1 dp; `0` when no days or no ceiling).
	interface AiUsageReport {
		from: string;
		to: string;
		totalUsd: number;
		budget: { globalDailyCeilingUsd: number; tenantDailyCeilingUsd: number };
		peakDailyUtilizationPct: number;
		byFeature: Array<{ featureKey: string; costUsd: number }>;
		byModel: Array<{ model: string; costUsd: number }>;
		byTenant: Array<{ storeId: string; costUsd: number }>;
		byFeatureModel: Array<{ featureKey: string; model: string; costUsd: number }>;
		byDay: Array<{ dated: string; costUsd: number; utilizationPct: number }>;
	}

	// ─── Tenant product enrichment — `POST /products/enrich` (userToken) ────────
	//
	// Suggestion-only. Nothing here is persisted by the enrich call itself: the
	// operator accepts parts of the suggestion in the product form, and the app
	// writes those through the ordinary product update path. Every field is
	// therefore optional on the way out — a field the model declined to fill, or
	// one that failed server-side validation, is ABSENT rather than empty.

	type ProductEnrichField = 'name' | 'description' | 'seo' | 'attributes' | 'classification';

	// Closed set, not free text. `tone` reaches the model's SYSTEM channel, which
	// is the one channel carrying no guardrail content qualifier — an enum is what
	// makes tenant-controlled text structurally unreachable there.
	type ProductEnrichTone =
		| 'neutro y profesional'
		| 'formal'
		| 'cercano y amigable'
		| 'técnico y directo'
		| 'entusiasta y persuasivo';

	interface ProductEnrichRequest {
		// `PROD` + 6-10 digits. The product must already exist — an unsaved
		// product cannot be enriched, since the row IS the grounding source.
		productId: string;
		// Omitted or empty means all fields.
		fields?: ProductEnrichField[];
		tone?: ProductEnrichTone;
		// Bypass the response cache. Costs a fresh model call.
		regenerate?: boolean;
	}

	// ⚠️ `evidence` is REQUIRED here and optional on `Product['attributes']`, and
	// that asymmetry is deliberate: the model must justify every attribute it
	// proposes with a verbatim quote from the product's own data, while an
	// operator hand-authoring an attribute later owes no provenance.
	interface ProductEnrichAttribute {
		name: string;
		value: string;
		evidence: string;
	}

	// The model picks from a closed candidate set of the tenant's OWN active,
	// leaf-level categories and brands, and returns the picked id — never a name
	// the client would have to match back. An id outside the candidate set is
	// dropped server-side.
	//
	// ⚠️ `null` means "ninguna encaja" — a real answer, not a missing one. There
	// is no confidence score: the posture is a hard allowlist, not a threshold.
	//
	// `evidence` here is a justification and is NOT verbatim-checked, unlike
	// `ProductEnrichAttribute['evidence']`. Requiring a word-for-word quote would
	// push the model toward quoting back the category name it was just handed.
	interface ProductEnrichClassification {
		categoryId: string | null;
		brandId: string | null;
		evidence: string;
	}

	interface ProductEnrichSuggestion {
		name?: string;
		// ⚠️ A rendered STRING, not the structured object the model produces. The
		// server flattens compatibility/specifications/otherContent into the
		// pipe-delimited format the storefront's description parser expects.
		description?: string;
		seoTitle?: string;
		seoDescription?: string;
		// Absent when the model proposed none, or when every proposal failed the
		// server-side slot/evidence/value checks. Never an empty array.
		attributes?: ProductEnrichAttribute[];
		classification?: ProductEnrichClassification;
	}

	interface ProductEnrichResponse {
		suggestion: ProductEnrichSuggestion;
		// The model that actually produced it — the primary, or the escalation
		// model when the primary's output failed to parse.
		model: string;
		// Served from the response cache, so it cost no model call.
		cached: boolean;
	}
}

export {}; // NOSONAR
