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
	/** Shared platform DLQ depth — the same value is repeated on every provider row. */
	dlqDepth: number;
	/** Epoch ms of the most recent error datapoint in the 24h window. */
	lastIncidentAt?: number;
	refreshFailures24h: number;
	killSwitchEnabled?: boolean;
}

// Aggregate keyed by provider id ('mercadopago' | 'mercadolibre' | 'stripe' |
// 'afip' | 'whatsapp' | 'gmail' today) — deliberately kept open as `string`
// so a new BE provider row degrades gracefully instead of failing the parse.
export type PlatformIntegrationsAggregate = Record<string, PlatformProviderHealth>;
