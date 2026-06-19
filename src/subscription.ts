/**
 * Subscription types — plan tiers, entitlements, feature matrix, subscription state.
 *
 * Ships app#710 (Chunk 1). Canonical decisions live in
 * sinfactura/app/docs/plans/SUBSCRIPTION_BUSINESS_DECISIONS.md and
 * sinfactura/app/docs/adr/0010-launch-trial-policy.md.
 *
 * Notes:
 * - Tier names are the 4 locked Spanish tiers (per SUBSCRIPTION_TIERS_BEST_PRACTICES §0
 *   and api#802): BÁSICO, EMPRENDEDOR, PROFESIONAL, AVANZADO. The launch policy
 *   (ADR-0010) gives every new paid subscription a 30-day Stripe trial; courtesy
 *   gifts (formerly the Founders cohort) are now a one-off ops action via
 *   `gift-subscription` that sets `freeUntil` on the SUBSCRIPTION row.
 * - `freeUntil` lives on every Subscription independent of status. It is the
 *   courtesy-gift cutoff; while `freeUntil > now` the BE suppresses billing.
 * - `FeatureKey` uses flat camelCase (not the dotted `reports.advanced` from the design kit).
 * - Monetary amounts are integers in minor units (ARS cents) to avoid float issues.
 * - Feature keys now match the BE wire format directly (renamed afip→afipInvoicing,
 *   cash→cashManagement, stripePayments→paymentIntegrations, reportsAdvanced→advancedReports
 *   as of 2026-04-26). New keys whatsappCommerce/aiFeatures/mobileApp/customDomain are
 *   declared here even when their epics haven't shipped — the matrix can set
 *   enabled:false until they do.
 */

declare global {
	// ───────────────────────────── Plan structure ─────────────────────────────

	type PlanTier = 'basico' | 'emprendedor' | 'profesional' | 'avanzado';

	/**
	 * Lifecycle status of a tenant's subscription.
	 *
	 * - `trialing` — new paid-tier signup in their 30-day Stripe trial.
	 * - `active` — paid subscription, period current.
	 * - `past_due` — payment failed, in the 7-day grace window.
	 * - `readonly` — grace elapsed, writes blocked, tenant can still read.
	 * - `canceled` — tenant ended subscription; data retained per grace policy.
	 *
	 * Courtesy gifts (formerly the Founders cohort, ADR-0009) are no longer a
	 * status — they are represented by `Subscription.freeUntil` on top of any
	 * normal status. See ADR-0010.
	 */
	type SubscriptionStatus =
		| 'trialing'
		| 'active'
		| 'past_due'
		| 'readonly'
		| 'canceled';

	type BillingCycle = 'monthly' | 'annual';

	// ───────────────────────────── Entitlements ─────────────────────────────

	/**
	 * Shape of a single entitlement on a (tier, feature) cell.
	 *
	 * - `boolean`  — on/off gate. `enabled` is the only relevant field.
	 * - `numeric`  — hard cap; `limit` required; block on overage.
	 * - `metered`  — usage-tracked; `limit` required. At launch behaves the same as
	 *                `numeric` (counter-based enforcement, no overage billing). Kept
	 *                distinct so post-launch metered billing can flip behavior without
	 *                a migration.
	 */
	type EntitlementType = 'boolean' | 'numeric' | 'metered';

	interface Entitlement {
		type: EntitlementType;
		/** `null` for `numeric`/`metered` types where on/off semantics don't apply (limit-driven). */
		enabled: boolean | null;
		/** Required for `numeric` and `metered`. `Infinity`-equivalent — treat sentinel value for "unlimited". */
		limit?: number;
		/** Origin of this entitlement entry. `plan` = from the tier matrix; `override` = tenant-specific override; `trial` = trial bonus. */
		source?: 'plan' | 'override' | 'trial';
	}

	// ───────────────────────────── Feature keys ─────────────────────────────

	/**
	 * All gated features. Add new keys here when a new feature becomes gateable;
	 * every existing plan in `FEATURE_MATRIX` must then declare the new key
	 * (TypeScript enforces this via `Record<FeatureKey, Entitlement>`).
	 */
	type FeatureKey =
		// Usage limits (numeric / metered)
		| 'maxOrdersMonth'
		| 'maxInvoicesMonth'
		| 'maxProducts'
		| 'maxUsers'
		| 'maxCustomers'
		| 'maxStores'
		| 'priceListsMax' // NEW — numeric cap on price lists (#1780 / types#87)
		// Facturación
		| 'afipInvoicing'
		| 'paymentIntegrations'
		| 'suppliers'
		// Operación
		| 'cashManagement'
		| 'multiStore'
		| 'importExport'
		// Análisis
		| 'advancedReports'
		// Avanzado
		| 'customBranding'
		| 'apiAccess'
		| 'prioritySupport'
		// Future / cross-epic features (matrix may set enabled:false until epic ships)
		| 'whatsappCommerce'
		| 'aiFeatures'
		| 'mobileApp'
		| 'customDomain'
		| 'advancedPricing'; // NEW — boolean gate: absolute / per-list-currency / breaks / promos (#1780 / types#87)

	/** Full feature matrix — every tier declares every feature. */
	type FeatureMatrix = Record<PlanTier, Record<FeatureKey, Entitlement>>;

	/** Resolved entitlements for a specific tenant (matrix + overrides applied). */
	type ResolvedEntitlements = Record<FeatureKey, Entitlement>;

	// ───────────────────────────── Plan catalog ─────────────────────────────

	/**
	 * Implementation status of a feature on a plan row. Informational —
	 * gating still happens via `enabled` / `limit`. `'service'` rows
	 * (e.g. prioritySupport) are human-delivered but still gated like
	 * booleans.
	 */
	type PlanFeatureStatus = 'live' | 'planned' | 'future' | 'service';

	/**
	 * A single feature row in a Plan's `features[]` array. Matches the
	 * BE wire format from `GET /subscription/plans` exactly — boolean
	 * features carry `enabled`, numeric/metered carry `limit` (-1 =
	 * unlimited).
	 */
	interface PlanFeature {
		key: FeatureKey;
		type: EntitlementType;
		status: PlanFeatureStatus;
		/** User-facing Spanish description. */
		description: string;
		/** Set on `boolean` features; `null` on numeric/metered. */
		enabled: boolean | null;
		/** Set on `numeric`/`metered` features; `null` on boolean. -1 = unlimited. */
		limit: number | null;
	}

	/**
	 * A sellable plan in the catalog. Aligned with the BE wire format from
	 * `GET /subscription/plans` (api#859). Source of truth lives in
	 * DynamoDB (`PLAN#{tier}` partition), administered via `POST /sa/plans`
	 * + `PATCH /sa/plans/{tier}` (api#859).
	 *
	 * Prices are integers in the `currency` smallest unit (centavos for ARS,
	 * cents for USD). `null` = "Contactar ventas" (AVANZADO annual at launch
	 * is sales-led; basico/fundador are free) per spec §6.4.
	 *
	 * **Breaking change vs 1.1.x:** the catalog Plan interface was reshaped
	 * to match the BE wire format. Renames & removals:
	 *   - `label` → `name`
	 *   - `blurb` → `description`
	 *   - `priceMonthly` → `priceMonthlyCents` (number | null)
	 *   - `priceAnnual` → `priceAnnualCents` (number | null)
	 *   - `currency` widened to `'ARS' | 'USD' | null`
	 *   - `entitlements: Record<FeatureKey, Entitlement>` → `features: PlanFeature[]`
	 *   - `isPublic` removed (use `isActive` for visibility gating)
	 *   - `stripeMonthlyPriceId` / `stripeAnnualPriceId` /
	 *     `mpPreApprovalPlanIdMonthly` / `mpPreApprovalPlanIdAnnual` removed
	 *     (BE-internal — not on the public wire format)
	 *   - `createdAt` / `updatedAt` removed (not on the public wire format)
	 *
	 * Added per api#859:
	 *   - `displayOrder` (number)
	 *   - `color` (single hex string, FE derives `soft`/`border` shades)
	 *   - `isPopular` (now required, was optional)
	 */
	interface Plan {
		tier: PlanTier;
		/** Display name in Spanish (e.g. "Profesional"). */
		name: string;
		/** Short marketing one-liner in Spanish. */
		description: string;
		/**
		 * Whether the plan is shown on the pricing page and accepting new
		 * subscribers. Pre-launch / sales-led tiers (e.g. AVANZADO until ≥2
		 * Planned features ship) set this to `false` without deleting the row.
		 */
		isActive: boolean;
		/**
		 * Anchor / recommended tier on the pricing page. The FE typically
		 * renders the "Más elegido" pill on the plan(s) flagged here. The
		 * BE does not enforce uniqueness — admins can flag any number of
		 * plans, but the canonical convention is exactly one.
		 */
		isPopular: boolean;
		/** Sort order on the pricing page (ascending). Ties allowed. */
		displayOrder: number;
		/** Monthly price in `currency` smallest units. `null` = sales-led / free. */
		priceMonthlyCents: number | null;
		/** Annual price in `currency` smallest units. `null` = sales-led / free. */
		priceAnnualCents: number | null;
		/**
		 * Currency the prices are denominated in. `'ARS'` at launch; `'USD'`
		 * is the migration target (api#841). `null` on free / off-billing
		 * tiers (basico).
		 */
		currency: 'ARS' | 'USD' | null;
		/**
		 * Single brand hex color (e.g. '#590d82'). The FE derives `soft`
		 * (light tint) and `border` shades via MUI's `alpha()` helper.
		 * `null` on plans created/seeded before the api#859 backfill.
		 */
		color: string | null;
		/**
		 * Per-feature configuration. Every `FeatureKey` appears exactly once.
		 * Boolean features carry `enabled`; numeric/metered carry `limit`.
		 */
		features: PlanFeature[];
		/**
		 * Marketing-curated short bullets shown on the customer-facing
		 * pricing card. Display order = array order. Recommended 3-5
		 * entries; the BE allows up to 6, each up to 80 chars (one card
		 * line). Always present — empty array when no bullets are set
		 * (FE then falls back to a synthesized list from `features[]`).
		 *
		 * Lifted onto the row in api#869 to let marketing tweak copy via
		 * `/sa/plans` without a redeploy. Replaces the FE-only
		 * `BULLET_LIST_BY_TIER` constant.
		 */
		bullets: string[];
	}

	// ───────────────────────────── Plan audit ─────────────────────────────

	/**
	 * One audit row per SUPER_ADMIN-driven plan mutation. Returned by
	 * `GET /platform/billing/plans/{tier}/audit` (api#859). The store-subscription
	 * audit (api#827) shares this storage shape but is read as
	 * `SubscriptionAuditEntry`.
	 *
	 * `before` and `after` carry only the fields that changed (diff slice),
	 * not the full row blob.
	 */
	interface PlanAuditEntry {
		entity: 'PLAN';
		entityId: string;
		timestamp: number;
		actor: { userId: string; fullName: string };
		action: string;
		before: Record<string, unknown>;
		after: Record<string, unknown>;
		reason: string;
		createdAt: number;
	}

	// ───────────────────────────── Subscription state ─────────────────────────────

	/**
	 * A tenant's current subscription row. One per `tenantId`.
	 * Stored in DynamoDB; mirrored to Stripe when `stripeSubscriptionId` is present.
	 */
	interface Subscription {
		tenantId: string;
		planTier: PlanTier;
		status: SubscriptionStatus;
		billingCycle: BillingCycle;
		/**
		 * Currency this subscription was billed in at checkout time.
		 * Snapshotted from the Plan's `currency` field so it survives
		 * platform-wide currency switches (api#841 / api#842) — a customer
		 * who signed up on ARS keeps being charged in ARS even after the
		 * platform flips to USD for new signups. Required for accurate
		 * historical reporting + AFIP invoices.
		 */
		currency?: 'ARS' | 'USD';
		/** Current period window (Unix ms). */
		currentPeriodStart: number;
		currentPeriodEnd: number;
		/** Set while `status === 'trialing'`. Unix ms. */
		trialEndsAt?: number;
		/**
		 * Courtesy-gift cutoff (ADR-0010) — YYYY-MM-DD up to which billing is
		 * suppressed regardless of `status`. String (not numeric ms) so it's
		 * human-readable in the DynamoDB console. Set/cleared via the
		 * `gift-subscription` super endpoint with an audit-logged reason.
		 */
		freeUntil?: string;
		/** Stripe identifiers (absent before first checkout). */
		stripeCustomerId?: string;
		stripeSubscriptionId?: string;
		/**
		 * Per-tenant entitlement overrides (grandfathering). Applied on top of the
		 * plan's base entitlements when resolving.
		 */
		overrides?: Partial<Record<FeatureKey, Entitlement>>;
		createdAt: number;
		updatedAt: number;
	}

	// ───────────────────────────── Usage (counter-based) ─────────────────────────────

	/**
	 * Per-tenant, per-period usage counters for `metered` features. Monthly reset
	 * via scheduled Lambda (api#629). At launch, used only for local enforcement;
	 * not reported to Stripe Meter (metered billing is a post-launch concern).
	 */
	interface UsageCounters {
		tenantId: string;
		/** Period start (Unix ms). Aligns with `Subscription.currentPeriodStart`. */
		periodStart: number;
		periodEnd: number;
		/** Counters keyed by the metered-feature FeatureKey. Keys default to 0 when absent. */
		counters: Partial<Record<FeatureKey, number>>;
		updatedAt: number;
	}

	// ───────────────────────────── WebSocket sync ─────────────────────────────

	/** A single entitlement entry as returned by GET /subscription. */
	interface SubscriptionEntitlementEntry {
		key: FeatureKey;
		type: EntitlementType;
		enabled: boolean | null;
		limit: number | null;
		source: 'plan' | 'override' | 'trial';
	}

	/** A single usage entry as returned by GET /subscription. */
	interface SubscriptionUsageEntry {
		key: FeatureKey;
		/** Period in YYYYMM format; `null` for lifetime caps (maxProducts/maxCustomers/maxUsers). */
		period: string | null;
		current: number;
		/** `null` for unlimited tiers (no cap). */
		limit: number | null;
		/** `null` when `limit` is unlimited/uncapped. */
		remaining: number | null;
	}

	/**
	 * Full subscription snapshot pushed to the frontend on subscription/entitlement
	 * changes. Flat shape — matches GET /subscription wire format directly.
	 */
	interface SubscriptionSyncPayload {
		planTier: PlanTier;
		status: SubscriptionStatus;
		/** Billing currency snapshotted from the plan template; `null` on free/unbilled tiers (basico). */
		currency: 'ARS' | 'USD' | null;
		billingCycle: BillingCycle | null;
		currentPeriodStart: number | null;
		currentPeriodEnd: number | null;
		trialEndsAt: number | null;
		/** Courtesy-gift cutoff (ADR-0010). YYYY-MM-DD or omitted. */
		freeUntil?: string;
		cancelAt: number | null;
		canceledAt: number | null;
		entitlements: SubscriptionEntitlementEntry[];
		usage: SubscriptionUsageEntry[];
	}

	// ───────────────────────────── Subscription admin override (api#827) ─────────────────────────────

	/**
	 * Request body for the MANAGER out-of-band override
	 * `PUT /platform/stores/{storeId}/subscription` (api#827). No Stripe call —
	 * a direct DynamoDB write + audit row. `trialEndsAt` is required when
	 * `status === 'trialing'`; `reason` is the audit message (min 10 chars).
	 */
	interface SubscriptionAdminOverrideInput {
		planTier: PlanTier;
		status: SubscriptionStatus;
		billingCycle: BillingCycle;
		/** Courtesy-gift cutoff (ADR-0010), `YYYY-MM-DD`. Optional on any status. */
		freeUntil?: string;
		/** Trial end (Unix ms). Required when `status === 'trialing'`. */
		trialEndsAt?: number;
		reason: string;
	}

	/**
	 * One audit row for a MANAGER out-of-band subscription change, as returned by
	 * `GET /platform/stores/{storeId}/subscription/audit` (api#827). Written by
	 * the override endpoint and the gift endpoint to the
	 * `AUDIT#SUBSCRIPTION#{storeId}` partition. `before`/`after` carry the
	 * subscription fields an operator can change.
	 */
	interface SubscriptionAuditEntry {
		storeId: string;
		timestamp: number;
		actor: { userId: string; fullName: string };
		before: Pick<Subscription, 'planTier' | 'status' | 'billingCycle' | 'freeUntil' | 'trialEndsAt'>;
		after: Pick<Subscription, 'planTier' | 'status' | 'billingCycle' | 'freeUntil' | 'trialEndsAt'>;
		reason: string;
	}
}

export {}; // NOSONAR