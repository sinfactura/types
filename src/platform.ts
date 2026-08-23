// Platform-wide config/feature-flag contracts. Single fixed
// GLOBALS/PLATFORM scope, unlike Literals' multi-scope override chain — no
// per-tenant override use case identified for globals/flags (deliberate
// divergence from the Literals model).

export interface PlatformConfigEntry {
	key: string;
	valueType: 'boolean' | 'string' | 'number';
	kind: 'setting' | 'flag';
	value: string | number | boolean;
	defaultValue: string | number | boolean;
	// Retired 'web'. `scope` names the consuming REPO, not an audience,
	// and POST /platform/globals validates z.enum(['app','landing','storefront']),
	// so a 'web' value is rejected with a 400 and can never be read back.
	scope: 'app' | 'landing' | 'storefront';
	description?: string;
	// Inclusive bounds for a `valueType: 'number'` key. Absent on
	// unbounded/boolean/string keys. These are part of the WRITE contract, not a
	// display hint: `POST /platform/globals` rejects an out-of-range value with a
	// 400, so a client that ignores them lets an operator submit a value that
	// cannot be saved. Render a bounded input and pre-empt the rejection.
	min?: number;
	max?: number;
	updatedBy?: string;
	updatedAt?: number;
	// The value this key held immediately before its last write — an undo
	// hint. Absent when the key has never been overridden.
	previousValue?: string | number | boolean;
	source: 'default' | 'override';
}

export interface PlatformGlobalsPostBody {
	globals: Record<
		string,
		{
			value: string | number | boolean | null;
			valueType: 'boolean' | 'string' | 'number';
			kind: 'setting' | 'flag';
			// See PlatformConfigEntry.scope above; 'web' is rejected.
			scope: 'app' | 'landing' | 'storefront';
		}
	>;
}

// Per-provider row of `GET /platform/integrations` (managerToken).
// The CloudWatch-derived fields (`syncSuccessRate24h`, `p95LatencyMs`,
// `lastIncidentAt`) are ABSENT — not 0/false — for providers without a
// backing Lambda, and `killSwitchEnabled` is absent for providers without a
// kill switch wired; keep them optional.
export interface PlatformProviderHealth {
	tenantsConnected: number;
	/** 24h success ratio in [0, 1] (a fraction, NOT a percentage). */
	syncSuccessRate24h?: number;
	/** Integer milliseconds. */
	p95LatencyMs?: number;
	/** Shared platform DLQ depth — the same value is repeated on every provider row.
	 *  ⚠️ OPTIONAL on purpose: absent means "no DLQ datapoint in the window", which is
	 *  NOT the same as a measured depth of zero. Rendering the two identically is the
	 *  synthesise-on-no-data defect this shape exists to remove. */
	dlqDepth?: number;
	/** Epoch ms of the most recent error datapoint in the 24h window. */
	lastIncidentAt?: number;
	refreshFailures24h: number;
	killSwitchEnabled?: boolean;
	/**
	 * True iff a health-representative Lambda backs this provider's
	 * CloudWatch-derived fields. REQUIRED so a consumer must handle all three
	 * states rather than reading absent-as-false:
	 *   `monitored: false`                  → not monitored, no data source
	 *   `monitored: true`, metrics absent   → monitored but idle (zero invocations)
	 *   `monitored: true`, metrics present  → measured
	 */
	monitored: boolean;
	/**
	 * Hourly buckets over the trailing 24h, ascending by `t`. Absent when the
	 * provider is unmonitored, or monitored with no datapoints — never an empty
	 * array standing in for "no data".
	 */
	deliveries24h?: PlatformProviderDeliveryBucket[];
}

/** One hourly bucket of the trailing-24h webhook-delivery series. */
export interface PlatformProviderDeliveryBucket {
	/** Bucket start, epoch ms. */
	t: number;
	/** Successful invocations in the bucket (invocations − errors, clamped at 0). */
	ok: number;
	/** Errored invocations in the bucket. */
	err: number;
}

/**
 * MANAGER-only read of our OAuth *application* config.
 * ⚠️ Never carries a client secret or a webhook signing key.
 */
export interface PlatformOAuthAppConfig {
	provider: 'mercadopago' | 'mercadolibre' | 'gmail';
	/** Absent when the provider's client id is not configured in this stage. */
	clientId?: string;
	/** Per-stage, computed — the value the BE actually registers with the provider. */
	redirectUri: string;
	/**
	 * Absent for `mercadopago` and `mercadolibre`: neither sends a `scope` param at
	 * all — their scopes are configured app-side in the provider's own dashboard, so
	 * emitting them here would put unmeasured text on the wire as if it were read
	 * config. Only `gmail` sends a real scope string.
	 */
	scopes?: string[];
}

export type PlatformOAuthAppConfigResponse = { data: PlatformOAuthAppConfig[] };

// Aggregate keyed by provider id ('mercadopago' | 'mercadolibre' | 'stripe' |
// 'afip' | 'whatsapp' | 'gmail' today) — deliberately kept open as `string`
// so a new BE provider row degrades gracefully instead of failing the parse.
export type PlatformIntegrationsAggregate = Record<string, PlatformProviderHealth>;
