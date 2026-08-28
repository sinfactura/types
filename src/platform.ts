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
 * One disagreement between a plan's copy and its entitlements.
 *
 * ⚠️ Absence of a warning is NOT a claim that the copy is correct. The matcher
 * pairs a bullet to a feature only on a single unambiguous keyword; a bullet
 * matching two keywords or none is skipped rather than guessed, so it
 * deliberately understates. Reading an empty array as "this tier's copy is
 * verified" inverts that design.
 */
export interface CatalogWarning {
	code: CatalogWarningCode;
	/** Which piece of copy produced it — one of the `bullets`, or the `description`. */
	source: 'bullets' | 'description';
	/** The offending bullet, or the description, verbatim. */
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
