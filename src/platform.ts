// Platform-wide config/feature-flag contracts (api#1108). Single fixed
// GLOBALS/PLATFORM scope, unlike Literals' multi-scope override chain — no
// per-tenant override use case identified for globals/flags (deliberate
// divergence from api#1484/#1485's Literals model).

export interface PlatformConfigEntry {
	key: string;
	valueType: 'boolean' | 'string' | 'number';
	kind: 'setting' | 'flag';
	value: string | number | boolean;
	defaultValue: string | number | boolean;
	scope: 'app' | 'web' | 'landing' | 'storefront';
	description?: string;
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
			scope: 'app' | 'web' | 'landing' | 'storefront';
		}
	>;
}
