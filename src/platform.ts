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
	// Inclusive length ceiling for a `valueType: 'string'` key. Absent on
	// unbounded/boolean/number keys. Part of the same WRITE contract as
	// `min`/`max` above and refused the same way — `POST /platform/globals`
	// answers 400 on an over-length value, so a client that ignores it lets an
	// operator submit a value that cannot be saved.
	//
	// It is not a typo guard: a string global can be rendered where a real size
	// budget applies. `currentAppVersion` rides an HTTP response header on every
	// request, so an unbounded value breaks a surface with no idea where the
	// value came from.
	maxLength?: number;
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

/**
 * AFIP certificate expiry band. Graduated from the api's
 * `lambdas/afipCertMonitor/bands.ts`, which is where it is computed — it reaches
 * the wire on the tenant health envelope, so it cannot stay repo-local.
 *
 * `bandFor` returns `undefined` above 60 days; consumers see `null` at the wire
 * boundary, never `undefined`.
 */
export type CertBand = 'expired' | '14' | '30' | '60';

/**
 * Cross-tab tenant health for the super-admin console.
 *
 * ⚠️ Derived booleans and epochs ONLY. No part of the STORE row is echoed —
 * STORE rows embed live secrets and no read helper sanitizes them, so this shape
 * is an explicit allow-list rather than a filtered row.
 *
 * ⚠️ `lastActivityAt` is deliberately ABSENT: it is not implementable from this
 * Lambda without widening its IAM onto the operational table, which was
 * deliberately avoided by keeping user-activity in its own function. Do not add
 * it here without moving that boundary first.
 */
export interface TenantHealthEnvelope {
	storeId: string;
	subscription: {
		/**
		 * `'unknown'` is a READ-FAILURE sentinel, not a subscription state: the
		 * console degrades this leg rather than 404ing the whole envelope, so a
		 * consumer must distinguish "no subscription row read" from any real
		 * status. Never persist it — it exists only on this wire shape.
		 */
		status: SubscriptionStatus | 'unknown';
		/**
		 * The courtesy-gift cutoff as a **`YYYY-MM-DD` calendar-date string**,
		 * or `null` when unset or when the subscription leg failed to read.
		 *
		 * ⚠️ **This was published as `number | null` and that was wrong** — the
		 * handler has always sent the string straight off the row. Every other
		 * declaration of this field in this package already says so, including
		 * one that states it explicitly: *"`YYYY-MM-DD`, matches
		 * `Subscription.freeUntil` — not epoch ms."* This envelope was the sole
		 * outlier, so a consumer that trusted it and did date arithmetic on a
		 * `number` was comparing against `NaN`, which is false against every
		 * bound and therefore fails by silently never showing the gift.
		 *
		 * It is a calendar date rather than an instant deliberately: a courtesy
		 * runs to the END of the named day in the tenant's own reckoning, and an
		 * epoch stamp would fix it to one instant in one zone.
		 */
		freeUntil: string | null;
		trialEndsAt: number | null;
	};
	afip: {
		hasCert: boolean;
		/** ms-epoch of the cert's `notAfter`. */
		certExpiry: number | null;
		/** `null` above 60 days, where `bandFor` returns `undefined`. */
		certBand: CertBand | null;
	};
	integrations: {
		/** Presence and expiry ONLY — never the OAuth tokens. */
		mercadopago: { connected: boolean; oauthExpiresAt: number | null };
		whatsapp: { enabled: boolean };
		sms: { enabled: boolean };
	};
	maintenance: { active: boolean; scope: 'platform' | 'store' | null };
}


/**
 * Why ONE tenant's row on a cross-tenant roll-up is missing data, on a walk
 * that otherwise completed.
 *
 * ⚠️ A page-level flag cannot express this and must not be added instead. Both
 * roll-ups walk the `PK='STORE'` partition and are RESUMABLE, so page
 * truncation is answered by `LastEvaluatedKey` — a cursor the grid can actually
 * finish the walk with, rather than a boolean it can only warn about. This
 * marker is the other case entirely: the walk finished, the row is present, and
 * one tenant's data is missing anyway. A page-level `complete: true` beside such
 * a row is a confidently wrong answer.
 *
 * A CLOSED set, not a free string: the grid renders a different explanation per
 * value, and a widened `string` would let a new failure path ship a code no
 * consumer handles.
 *
 * `SUBSCRIPTION_READ_UNRESOLVED` is the subtlest and the reason this type
 * exists. The batched subscription read retries `UnprocessedKeys` with bounded
 * backoff and then gives up; a tenant lost that way is simply ABSENT from the
 * result, which is indistinguishable from a tenant that genuinely has no
 * subscription row — and that absence resolves to the documented
 * profesional/active default. Without this marker a throttled read renders as a
 * healthy tenant.
 */
export type TenantRollupRowError = 'SUBSCRIPTION_READ_UNRESOLVED' | 'USAGE_READ_FAILED';

/**
 * One row of `GET /tenants/health` — the cross-tenant health grid.
 *
 * Deliberately the per-tenant envelope PLUS the two things a grid needs that a
 * single-tenant read does not: a display `name`, and the per-row failure
 * marker. Extending rather than restating is the point — a hand-copied mirror
 * of `TenantHealthEnvelope` is exactly how a roll-up and its per-tenant sibling
 * drift while both keep compiling.
 *
 * ⚠️ Inherits the envelope's allow-list guarantee: every field is a boolean, an
 * epoch or a small enum DERIVED from a row, and no part of a STORE row is
 * echoed. The roll-up goes further than its sibling at the read itself — it
 * projects the STORE query down to the handful of paths it needs, so the AFIP
 * private key and the MercadoPago OAuth tokens never enter the process at all.
 */
export interface TenantHealthRollupRow extends TenantHealthEnvelope {
	/** `Store.name`. */
	name: string;
	/** Absent on success. */
	rowError?: TenantRollupRowError;
}

/**
 * One row of `GET /tenants/usage` — the cross-tenant "usage vs plan limits"
 * grid.
 *
 * ⚠️ The meters carry a RESOLVED `limit`, not just a counter. The per-tenant
 * `GET /tenants/{storeId}/usage` returns `{ key, current }` with no denominator,
 * and on a grid that is not a shortcut a consumer can take: filling the
 * denominators client-side would mean resolving entitlements per tenant from
 * the browser — the unbounded fan-out this endpoint exists to prevent,
 * reintroduced one layer up. The limit is plan template PLUS per-store
 * override, resolved api-side.
 *
 * `-1` in a `limit` means UNLIMITED, matching `StoreEntitlementOverride`. No new
 * sentinel was introduced.
 */
export interface TenantUsageRollupRow {
	storeId: string;
	/** `Store.name`. */
	name: string;
	/** `null` when the tenant has no SUBSCRIPTION row at all. */
	planTier: PlanTier | null;
	status: SubscriptionStatus | null;
	/** `YYYYMM`, Buenos Aires reckoning — the period the `metered` counters cover. */
	period: string;
	/**
	 * The monthly counters, which RESET at the period boundary. A tenant at 95%
	 * here is a forecast: worst case they wait a few days.
	 */
	metered: SubscriptionUsageEntry[];
	/**
	 * The lifetime caps — `maxProducts` / `maxCustomers` / `maxUsers`, whose
	 * entries carry `period: null` because they never reset. A tenant at one of
	 * these is ALREADY BLOCKED, right now, with no path out but an upgrade or an
	 * override, which is why the harder half is here at all.
	 *
	 * ⚠️ OPTIONAL, and absence means "not resolved in this pass" — never "zero".
	 * Render it when present and em-dash it when absent, the same treatment
	 * `lastActivityAt` gets elsewhere. Declared optional from the start so that
	 * populating it later is a DATA change rather than a layout change or a
	 * contract break.
	 */
	lifetime?: SubscriptionUsageEntry[];
	/** Absent on success. */
	rowError?: TenantRollupRowError;
}

/** One operator-authored internal note about a tenant. NEVER tenant-facing. */
export interface StoreNoteAuthor {
	userId: string;
	/**
	 * Resolved at WRITE time via `resolveAuditActor`.
	 *
	 * ⚠️ REQUIRED but possibly EMPTY. `resolveAuditActor`'s documented degradation
	 * is `{ userId, fullName: '' }` — it returns an empty string rather than
	 * omitting the field, deliberately, so an audit still writes instead of the
	 * mutation refusing. Declaring it optional would make the contract imply
	 * "absent" where the api actually writes `''`, forcing every consumer to
	 * handle two spellings of one condition.
	 */
	fullName: string;
}

/**
 * ⚠️ Wire shape only. The stored row additionally carries `PK`/`SK`, which must
 * never reach a consumer — the same split as `PrinterRow` vs `PrintPrinter`.
 */
export interface StoreNote {
	noteId: string;
	/** Plain text for v1. Trimmed, non-empty, <= 5000 chars — enforced at the api boundary. */
	body: string;
	author: StoreNoteAuthor;
	createdAt: number;
	updatedAt?: number;
	lastEditedBy?: StoreNoteAuthor;
}

/** POST/PUT request body for a store note. */
export interface StoreNoteInput {
	body: string;
}

/** FE projection of the internal `OverrideRow`. */
export interface StoreEntitlementOverride {
	key: FeatureKey;
	type: EntitlementType;
	/** Present iff `type === 'boolean'`. */
	enabled?: boolean;
	/** Present iff `type === 'numeric'`. `-1` means unlimited. */
	limit?: number;
	reason: string;
	/**
	 * ⚠️ Unix SECONDS, not milliseconds — named for its unit because it is the one
	 * seconds-valued field in a milliseconds codebase. It populates the DynamoDB
	 * TTL attribute directly, and TTL is specified in seconds.
	 */
	expiresAtSeconds?: number;
	/** ms-epoch. */
	createdAt: number;
	/** ms-epoch. */
	updatedAt: number;
}

/** Write body for a per-store entitlement override. */
export interface OverrideWriteInput {
	key: FeatureKey;
	type: EntitlementType;
	enabled?: boolean;
	limit?: number;
	/** Operator justification, min 10 chars trimmed. Written to the audit entry. */
	reason: string;
	/**
	 * ⚠️ Unix SECONDS, not milliseconds. See `StoreEntitlementOverride`. A
	 * millisecond value is rejected at the api boundary rather than silently
	 * setting a TTL ~31,000 years out.
	 */
	expiresAtSeconds?: number;
}

/**
 * GET response: the raw override rows plus the resolved effective bundle.
 *
 * ⚠️ `resolved` is the whole bundle, not a bare feature map — the per-feature
 * entries sit one level down, under `entitlements`. Through 1.10.133 this was
 * typed as `ResolvedEntitlements`, so a consumer that indexed `resolved` by
 * feature key was reading a level the api has never sent.
 *
 * The two halves are deliberately both here and neither derives the other: a
 * key can be enabled in `resolved` with no row in `overrides`, which is the
 * plan default showing through, and an operator UI that cannot tell those apart
 * will offer to "remove" an override that does not exist.
 */
export interface StoreOverridesEnvelope {
	overrides: StoreEntitlementOverride[];
	resolved: StoreEntitlementsBundle;
}


// ---------------------------------------------------------------------------
// Cross-tenant operator control plane (Ops API).
// ---------------------------------------------------------------------------

/**
 * One active refresh-token session for a tenant user, as returned to a
 * SUPERVISOR/MANAGER operator. Deliberately carries NO token material: `jti`
 * and `family` identify a session for revocation, they do not authenticate one.
 */
export interface TenantUserSessionSummary {
	jti: string;
	family: string;
	/**
	 * ⚠️ Unix SECONDS, not milliseconds — the api stamps it from
	 * `Math.floor(Date.now() / 1000)` and derives the session row's DynamoDB TTL
	 * from it, and a TTL attribute is seconds by definition, so the unit is
	 * load-bearing rather than incidental. The millisecond timestamps on other
	 * entities in this file are a genuine inconsistency, correct for those
	 * entities — do not reconcile them against this one. Tell:
	 * `new Date(issuedAt)` renders 1970, and an already-correct value "fixed" by
	 * multiplying renders ~year 57000.
	 */
	issuedAt: number;
	/**
	 * ⚠️ Unix SECONDS, not milliseconds. See `issuedAt`: this is
	 * `issuedAt + ttlSeconds`, so the two share a unit by construction, and
	 * comparing it against a millisecond clock reads every live session as long
	 * expired while never throwing.
	 */
	expiresAt: number;
	userAgent?: string;
	ip?: string;
}

/**
 * `complete: false` means the underlying scan was truncated and the list is a
 * prefix, not the whole set — never render it as "these are all the sessions".
 */
export interface TenantUserSessionsResponse {
	sessions: TenantUserSessionSummary[];
	complete: boolean;
}

/**
 * One row of the tenant-wide active-session roster: the per-user summary plus
 * the user it belongs to. Extends `TenantUserSessionSummary` rather than
 * restating its fields so the two cannot drift — in particular `issuedAt` and
 * `expiresAt` keep the SECONDS unit documented there.
 */
export interface TenantActiveSessionSummary extends TenantUserSessionSummary {
	userId: string;
	/**
	 * Absent when the user row carries no name. Normal for service and agent
	 * accounts, not a gap to backfill — render the `userId` instead of blank.
	 */
	fullName?: string;
}

/**
 * `complete: false` means the list is a prefix, not the whole set — never
 * render it as "these are all the sessions". On this endpoint it drops for
 * either of two independent reasons: the fan-out over the store's users was
 * capped, or one user's session page was. The response does not distinguish
 * them, so a caller cannot conclude "every user, some sessions" from it.
 */
export interface TenantActiveSessionsResponse {
	storeId: string;
	sessions: TenantActiveSessionSummary[];
	complete: boolean;
}

/** Revoke-all result. Idempotent: revoking with no sessions is `revoked: 0`, not an error. */
export interface TenantUserSessionsRevokeResponse {
	revoked: number;
	failed: number;
	complete: boolean;
}

/** One store's entry in the cross-store entitlement-override roster. */
export interface PlatformOverrideRosterEntry {
	storeId: string;
	overrideCount: number;
	/**
	 * ⚠️ Unix SECONDS, matching `StoreEntitlementOverride`'s TTL field rather
	 * than the millisecond timestamps elsewhere in this file. Absent when no
	 * override on that store carries an expiry.
	 */
	earliestExpiresAt?: number;
}

/**
 * Roster response. Built by a scheduled scan into a single `PLATFORM#OVERRIDES`
 * projection row rather than served from a GSI — `builtAt` is therefore the age
 * of the answer, and a caller that needs live data must read the per-store
 * route instead.
 */
export interface PlatformOverridesRosterResponse {
	entries: PlatformOverrideRosterEntry[];
	/** Unix ms. */
	builtAt: number;
}

/**
 * Why one tenant's payment history is missing from the billing roll-up. Its
 * PRESENCE is the whole point: an empty `invoices` array cannot distinguish a
 * tenant who has never been charged from one whose provider we could not
 * reach, and rendering the second as the first is how a billing outage reads
 * as a quiet month. Absent on success, including the legitimate empty case.
 *
 * - `BILLING_NOT_CONFIGURED` — the adapter exists but has not implemented the
 *   history call. Ours to fix; retrying never changes it.
 * - `EXTERNAL_RESOURCE_NOT_FOUND` — we hold a provider-side id the provider no
 *   longer recognizes, typically because the tenant cancelled or deleted it in
 *   the provider's own dashboard. Permanent until the linkage is re-made.
 * - `INVALID_PROVIDER` — the stored provider value names no adapter we have. A
 *   data defect on the SUBSCRIPTION row, not an outage.
 * - `PROVIDER_UNAVAILABLE` — everything else: an outage, a rate limit, an
 *   expired token. The only one of the four worth retrying, and the only one
 *   expected to clear on its own.
 */
export type TenantBillingHistoryError =
	| 'BILLING_NOT_CONFIGURED'
	| 'EXTERNAL_RESOURCE_NOT_FOUND'
	| 'INVALID_PROVIDER'
	| 'PROVIDER_UNAVAILABLE';

/**
 * One row of the cross-tenant billing grid behind `GET /tenants/billing`
 * (supervisorToken). Served in the house envelope —
 * `ResponseApi<TenantBillingRollupRow[]>` — with no bespoke wrapper: the page
 * cursor is the raw `{ PK: 'STORE', SK }` of the underlying STORE query, which
 * `ResponseApi.LastEvaluatedKey` already covers, and the caller round-trips its
 * `SK` back as the next request's offset.
 *
 * An ALLOW-LIST, not a projection. STORE rows embed live secrets and the
 * SUBSCRIPTION row carries provider-side identifiers; nothing is spread into
 * this shape, so a field reaches a consumer only by being named here. A
 * consumer that "simplifies" by widening back toward either stored row is
 * undoing the only thing keeping those out of an operator console.
 *
 * It is deliberately wider than the `StoreRowSubscriptionSummary` carried on
 * `GET /tenants` rows — amounts, through `invoices` — and deliberately no
 * wider in the other direction: `externalCustomerId`,
 * `externalSubscriptionId`, `stripeCustomerId` and `stripeSubscriptionId` are
 * unemittable on both. The roll-up reads those ids only to decide whether a
 * provider round-trip is worth making.
 *
 * Every nullable field below is null together, for a tenant with no
 * SUBSCRIPTION row at all. That is an ordinary state — a store that never
 * subscribed — not a broken row to filter out of the grid.
 */
export interface TenantBillingRollupRow {
	storeId: string;
	/** The tenant's `Store.name`. */
	name: string;
	planTier: PlanTier | null;
	status: SubscriptionStatus | null;
	billingCycle: BillingCycle | null;
	/** Unix ms. */
	currentPeriodStart: number | null;
	/** Unix ms. */
	currentPeriodEnd: number | null;
	/** Unix ms. Only meaningful while `status === 'trialing'`. */
	trialEndsAt: number | null;
	/**
	 * ⚠️ `YYYY-MM-DD`, NOT epoch ms — the one field on this row that does not
	 * share its neighbours' unit, and it has been published as `number` once
	 * already. Tell: `new Date(freeUntil)` lands near 1970-01-01 for a value in
	 * the 2020s, so a live courtesy gift renders as long expired and nothing
	 * throws. It is a calendar cutoff rather than an instant, so there is no
	 * timezone to reconcile either — compare it as a string, never convert it.
	 */
	freeUntil: string | null;
	/** Unix ms. */
	cancelAt: number | null;
	/** Unix ms. */
	canceledAt: number | null;
	/**
	 * The resolved billing provider. `string` rather than a union because it is
	 * the SUBSCRIPTION row's own raw value and nothing validates it on write — a
	 * union here would assert a guarantee the data does not carry, and the value
	 * matching no adapter is exactly the one `historyError` reports as
	 * `INVALID_PROVIDER`.
	 */
	provider: string | null;
	/**
	 * The tenant's last few charges, capped at a handful per row: a cross-tenant
	 * grid renders recent activity, and a deep read belongs on the per-tenant
	 * history endpoint. Empty both for a tenant with no provider linkage and for
	 * one whose provider read failed — `historyError` is what separates those.
	 */
	invoices: InvoiceSummary[];
	/** Present only when THIS tenant's provider read failed; see `TenantBillingHistoryError`. */
	historyError?: TenantBillingHistoryError;
}

/**
 * Why a plan's marketing copy disagrees with the entitlements actually backing
 * that tier. Advisory only — `PATCH /platform/billing/plans/{tier}` reports
 * these and still applies the write. It never blocks: tiers are hand-tuned
 * between pricing decisions, so a mismatch is routinely the intended
 * intermediate state rather than an error.
 *
 * - `NUMERIC_MISMATCH` — a bullet advertises a number that differs from the
 *   numeric entitlement it maps to.
 * - `UNLIMITED_ADVERTISED_AS_CAPPED` — the entitlement is `-1` (unlimited) but
 *   the copy advertises a finite cap. Reported separately because the equality
 *   compare would otherwise render it as a nonsense mismatch against `-1`.
 * - `UNBACKED_CAPABILITY` — the copy names a capability the tier does not have
 *   `status: 'live'` and `enabled: true` for.
 * - `MISSING_FEATURE_ROW` — a bullet states a LIMIT for an entitlement the tier
 *   has no row for at all. Distinct from `UNBACKED_CAPABILITY` on purpose: that
 *   one means "the row exists but is not live/enabled", a state an operator
 *   fixes by flipping two flags, whereas this one means the row is absent —
 *   what deleting or renaming a key through
 *   `PATCH /platform/billing/plans/{tier}` produces — and is fixed by
 *   re-creating it. Collapsing them (as the API briefly did) hides the more
 *   severe of the two behind the more common one.
 */
export type CatalogWarningCode =
	| 'NUMERIC_MISMATCH'
	| 'UNLIMITED_ADVERTISED_AS_CAPPED'
	| 'UNBACKED_CAPABILITY'
	| 'MISSING_FEATURE_ROW';

/**
 * One disagreement between a plan's copy and its entitlements, or between the
 * declared feature catalog and a tier's stored rows.
 *
 * ⚠️ Absence of a warning is NOT a claim that the copy is correct. The matcher
 * pairs a bullet to a feature only on a single unambiguous keyword; a bullet
 * matching two keywords or none is skipped rather than guessed, so it
 * deliberately understates. Reading an empty array as "this tier's copy is
 * verified" inverts that design.
 *
 * ⚠️ That understatement had a second, larger hole: every check used to be
 * COPY-DRIVEN, so a declared feature key that no bullet happened to mention
 * could be missing its row on every tier and warn nothing. That is not
 * hypothetical — `storefront` was absent from all four production tiers, had no
 * marketing bullet, and therefore produced an empty `warnings` array while the
 * feature was locked for every tenant. `source: 'catalog'` exists so a check can
 * be driven by the declared key set instead of by what the copy happens to name.
 */
export interface CatalogWarning {
	code: CatalogWarningCode;
	/**
	 * What produced it — one of the `bullets`, the `description`, or `'catalog'`
	 * for a check driven by the declared feature key set rather than by copy.
	 */
	source: 'bullets' | 'description' | 'catalog';
	/**
	 * The offending bullet, or the description, verbatim. For `source:
	 * 'catalog'` there is no copy to quote — it carries the tier that was
	 * examined, which is the equivalent "what was checked" value.
	 */
	text: string;
	/** The entitlement the copy was checked against. */
	featureKey: FeatureKey;
	/** Human-readable, already safe to render as-is. */
	message: string;
}

/**
 * `GET /platform/dashboard` — infra-health rollup for the MANAGER operational
 * dashboard: CloudWatch alarms, Lambda/API Gateway error metrics, DLQ depth,
 * and estimated AWS billing. Deliberately separate from the business-KPI
 * rollup on `GET /platform/metrics` — this endpoint's IAM surface reads
 * CloudWatch and Cost Explorer, which the KPI endpoint keeps off its hot path.
 */
export interface PlatformDashboardResponse {
	/**
	 * `'unknown'` is a READ-FAILURE sentinel, not an infra state — some or all of
	 * the underlying CloudWatch reads failed, so the aggregate could not be
	 * computed either way. Never treat it as equivalent to `'ok'`.
	 */
	systemStatus: 'ok' | 'incident' | 'unknown';
	alarms: PlatformAlarm[];
	metrics: {
		lambdaErrorsByFunction: MetricSeries[];
		apiGateway4xx: MetricPoint[];
		apiGateway5xx: MetricPoint[];
		dlqDepth: MetricPoint[];
		lambdaThrottles: MetricPoint[];
	};
	billing: {
		estimatedMonthToDateUsd: number;
		dailyTrendUsd: MetricPoint[];
		topServicesByCostUsd: { service: string; costUsd: number }[];
		/**
		 * Epoch ms of the underlying billing cache's last write. `null` only
		 * before that cache has ever been populated for the first time — once
		 * written, every subsequent read carries a real timestamp, stale or not.
		 */
		asOf: number | null;
	};
	generatedAt: number;
}

/** One CloudWatch alarm's current state, as surfaced on the dashboard. */
export interface PlatformAlarm {
	name: string;
	state: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
	service: string;
	description?: string;
	/** Epoch ms; `null` when CloudWatch has not recorded a state transition. */
	stateChangedAt: number | null;
}

/** A named collection of `MetricPoint`s — one line on a multi-series chart. */
export interface MetricSeries {
	label: string;
	points: MetricPoint[];
}

/** One datapoint of a CloudWatch-derived time series. */
export interface MetricPoint {
	/** Epoch ms. */
	t: number;
	v: number;
}

/*
 * ─────────────────────────────────────────────────────────────────────
 * Cmd-K telemetry — `GET /platform/cmdk-stats` and its per-tenant
 * drilldown (`/tenant/{storeId}`). Both managerToken, Ops API.
 *
 * ⚠️ **`truncated` is a ROOT sibling of `data`, not a field inside it** —
 * see the two response envelopes at the bottom of this block. It is also
 * NOT routine paging: both handlers read the whole telemetry partition in
 * one pass against a fixed row cap and there is no resume cursor, so
 * `truncated: true` means the figures below UNDERSTATE the platform and
 * cannot be completed by asking again. Render it as a caveat on the
 * numbers, never as a "load more".
 *
 * ⚠️ Every panel is computed in the Lambda from a single full-partition
 * read, so `week` is a FILTER applied after the fact rather than a query
 * bound. `week: null` means "all weeks the partition still holds", and
 * `weeksAvailable` is the set actually present — a week absent from it has
 * no data rather than zero usage.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Platform-wide totals for the selected week (or for all retained weeks). */
export interface CmdkOverview {
	totalOpens: number;
	totalVerbUsages: number;
	totalQueryTyped: number;
	distinctStores: number;
	distinctVerbs: number;
}

/** One command and how often it was invoked. `actionId` is the FE's own verb id. */
export interface CmdkVerbCount {
	actionId: string;
	count: number;
}

/**
 * The least-used commands.
 *
 * ⚠️ **This is NOT "verbs with zero use", and reading it that way inverts
 * it.** The API has no view of the FE's command catalog — it only sees verbs
 * that were actually invoked — so it reports the least-used among verbs that
 * appear at least once. A command nobody has ever run is INVISIBLE here.
 *
 * ⚠️ **`lowSample: true` is a refusal to answer, and it returns `verbs: []`.**
 * Below `minDistinctStores` contributing stores, per-verb usage is dominated
 * by one or two operators' individual habits rather than platform behaviour,
 * so "dead verb" would mean "a command this one person doesn't happen to
 * use". An empty `verbs` under `lowSample` must never render as "every
 * command gets used" — it means the question was not answerable.
 */
export interface CmdkDeadVerbs {
	lowSample: boolean;
	/** The threshold that produced `lowSample`. */
	minDistinctStores: number;
	/** How many stores actually contributed rows. */
	distinctStores: number;
	verbs: CmdkVerbCount[];
}

/** One bucket of the "how long was the query when a verb fired" histogram. */
export interface CmdkQlenBucket {
	bucket: number;
	count: number;
}

/** Per-tenant totals, as listed on the platform dashboard. */
export interface CmdkTenantSummary {
	storeId: string;
	totalOpens: number;
	totalVerbUsages: number;
	totalQueryTyped: number;
}

/** One tenant's totals plus its own verb and query-length breakdowns. */
export interface CmdkTenantDrilldown extends CmdkTenantSummary {
	verbs: CmdkVerbCount[];
	qlen: CmdkQlenBucket[];
}

/** `data` of `GET /platform/cmdk-stats`. */
export interface CmdkStatsData {
	/** The `YYYY-Www` filter that was applied, or `null` for all retained weeks. */
	week: string | null;
	/** Every ISO week the partition still holds, ascending. */
	weeksAvailable: string[];
	overview: CmdkOverview;
	topVerbs: CmdkVerbCount[];
	deadVerbs: CmdkDeadVerbs;
	qlen: CmdkQlenBucket[];
	tenants: CmdkTenantSummary[];
}

/** `data` of `GET /platform/cmdk-stats/tenant/{storeId}`. */
export type CmdkTenantStatsData = CmdkTenantDrilldown & {
	/** The `YYYY-Www` filter that was applied, or `null` for all retained weeks. */
	week: string | null;
};

/**
 * `GET /platform/cmdk-stats` response.
 *
 * ⚠️ `truncated` sits HERE, beside `data` — not inside it. See the block
 * comment above for why it is a completeness caveat and not a paging signal.
 */
export interface CmdkStatsResponse {
	message: string;
	data: CmdkStatsData;
	truncated: boolean;
}

/** `GET /platform/cmdk-stats/tenant/{storeId}` response. Same `truncated` contract. */
export interface CmdkTenantStatsResponse {
	message: string;
	data: CmdkTenantStatsData;
	truncated: boolean;
}

// ── GET /platform/metrics ────────────────────────────────────────────────
//
// The operator dashboard's snapshot. Published rather than mirrored
// consumer-side: the MRR block below encodes revenue-recognition POLICY, and
// a number whose definition lives only in the emitting handler is one no
// consumer can reconcile against Stripe.

/** Rolling window a windowed metric was computed over. */
export type MetricsWindow = '24h' | '7d';

export interface PlatformTenantMetrics {
	total: number;
	demo: number;
	byPlan: Record<PlanTier, number>;
	byStatus: Record<SubscriptionStatus, number>;
	byBillingCycle: Record<BillingCycle, number>;
}

/**
 * Normalised monthly recurring revenue.
 *
 * `countedStatuses` and `annualDivisor` travel ON THE WIRE rather than living
 * only in the emitter, so a consumer can state what the figure means without
 * re-deriving it. Both are policy, not arithmetic.
 */
export interface PlatformMrrMetrics {
	/**
	 * ISO code the total is denominated in, DERIVED from the plan catalog
	 * rather than fixed — `'USD'` is a live migration target.
	 *
	 * `null` does NOT by itself mean the total is zero. Two distinct cases,
	 * told apart by `excluded.mixedPlanCurrencies`:
	 *
	 *   - `> 0` — priced plans DISAGREE (a half-finished migration). Nothing
	 *     was summed and `totalCents` is 0. Adding USD to ARS produces a
	 *     number that is not money in any currency, so the disagreement is
	 *     reported rather than averaged away.
	 *   - `0` — the priced plans agree, they just carry no `currency` (it is
	 *     nullable at creation). `totalCents` is a real total that cannot be
	 *     labelled.
	 */
	currency: 'ARS' | 'USD' | null;
	/** Normalised MRR in the currency's minor unit (centavos for ARS, cents for USD). */
	totalCents: number;
	/**
	 * The statuses `countedSubscriptions` was drawn from.
	 *
	 * `past_due` is INCLUDED — a paying subscription in dunning, not a lost
	 * one. `trialing`, `readonly` and `canceled` are excluded, the last even
	 * where `currentPeriodEnd` is still in the future: that knowingly
	 * understates the current month, and can only ever err downward, which is
	 * the safer direction for a number an operator acts on.
	 */
	countedStatuses: SubscriptionStatus[];
	/** `priceAnnualCents / annualDivisor` is one annual subscription's monthly contribution. */
	annualDivisor: number;
	/** Subscriptions in a counted status. The denominator for `excluded`. */
	countedSubscriptions: number;
	/**
	 * Counted subscriptions that contributed NOTHING, by reason. Mutually
	 * exclusive, so `countedSubscriptions - (sum of these)` is the number that
	 * actually contributed. Present so a zero is never silent: a wrong MRR and
	 * a correct one look identical without them.
	 */
	excluded: {
		/**
		 * The plan carries no price for this subscription's cycle. Expected to
		 * cover every free-tier row — `basico` has no price and no currency by
		 * design — so this is only a misconfiguration signal above that count.
		 */
		noPlanPrice: number;
		/** The row carries no `billingCycle`, so neither price applies to it. */
		noBillingCycle: number;
		/** Priced plans disagreed on currency, so nothing could be summed. */
		mixedPlanCurrencies: number;
	};
}

export interface PlatformInvoicingMetrics {
	window: MetricsWindow;
	issuedCount: number;
	issuedTotal: { currency: string; value: number };
	monthToDateCount: number;
}

export interface PlatformErrorMetrics {
	window: MetricsWindow;
	total: number;
	byOrigin: { app: number; web: number };
	activeAlerts: number | null;
}

export interface PlatformSessionMetrics {
	active: number;
}

/**
 * `GET /platform/metrics` payload.
 *
 * Every block is independently nullable: one failing pass must never cost the
 * caller the rest of the snapshot.
 */
export interface PlatformMetricsSnapshot {
	tenants: PlatformTenantMetrics | null;
	/**
	 * `null` when the tenant pass failed, or when the plan catalog could not
	 * be read — the counts stay useful without it.
	 */
	mrr: PlatformMrrMetrics | null;
	invoicing: PlatformInvoicingMetrics | null;
	errors: PlatformErrorMetrics | null;
	sessions: PlatformSessionMetrics | null;
	generatedAt: number;
}
