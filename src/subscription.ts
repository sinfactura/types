/**
 * Subscription types — plan tiers, entitlements, feature matrix, subscription state.
 *
 * Ships app#710 (Chunk 1). Canonical decisions live in
 * sinfactura/app/docs/plans/SUBSCRIPTION_BUSINESS_DECISIONS.md.
 *
 * Notes:
 * - Tier names are the 5 locked Spanish tiers (per SUBSCRIPTION_TIERS_BEST_PRACTICES §0
 *   and api#802 — the launch lineup is BÁSICO, EMPRENDEDOR, PROFESIONAL, AVANZADO,
 *   plus FUNDADOR for the pre-launch cohort).
 * - `fundador` is BOTH a `PlanTier` (the cohort plan template seeded at api#802) and a
 *   pre-existing `SubscriptionStatus` value (kept for backward compat — the registration
 *   flow now sets status='active' on fundador subscriptions).
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

	type PlanTier = 'basico' | 'emprendedor' | 'profesional' | 'avanzado' | 'fundador';

	/**
	 * Lifecycle status of a tenant's subscription.
	 *
	 * - `trialing` — new signup in the 30-day PROFESIONAL trial (no payment method).
	 * - `active` — paid subscription, period current.
	 * - `past_due` — payment failed, in the 7-day grace window.
	 * - `readonly` — grace elapsed, writes blocked, tenant can still read.
	 * - `canceled` — tenant ended subscription; data retained per grace policy.
	 * - `fundador` — legacy pre-cohort status. Post-api#802, fundador subscriptions
	 *   carry `status: 'active'` and are identified via `planTier === 'fundador'`.
	 */
	type SubscriptionStatus =
		| 'trialing'
		| 'active'
		| 'past_due'
		| 'readonly'
		| 'canceled'
		| 'fundador';

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
		| 'customDomain';

	/** Full feature matrix — every tier declares every feature. */
	type FeatureMatrix = Record<PlanTier, Record<FeatureKey, Entitlement>>;

	/** Resolved entitlements for a specific tenant (matrix + overrides applied). */
	type ResolvedEntitlements = Record<FeatureKey, Entitlement>;

	// ───────────────────────────── Plan catalog ─────────────────────────────

	/**
	 * A sellable plan in the catalog. Seeded into DynamoDB by api#626 and
	 * served to the frontend via GET /subscription/plans.
	 *
	 * Prices are integers in ARS cents (e.g. $40 000 = 4_000_000).
	 * `null` = "Contactar ventas" (AVANZADO, pre-unlock).
	 */
	interface Plan {
		tier: PlanTier;
		/** Display label — "BÁSICO", "EMPRENDEDOR", "PROFESIONAL", "AVANZADO", "FUNDADOR". */
		label: string;
		/** Short marketing tagline (Spanish). */
		blurb?: string;
		/** Price in the plan's `currency` smallest unit for monthly billing. `null` = contactar. */
		priceMonthly: number | null;
		/** Price in the plan's `currency` smallest unit for annual billing (total / 12; ~20% discount). `null` = contactar. */
		priceAnnual: number | null;
		/**
		 * Currency the prices are denominated in. `'ARS'` at launch; `'USD'`
		 * is the migration target (api#841). Widened from the launch-only
		 * `'ARS'` literal in api#842 so the FE can render either currency
		 * without a type change once the platform flips.
		 */
		currency: 'ARS' | 'USD';
		/**
		 * Whether the plan is accepting new subscribers. Closed-cohort plans
		 * (e.g. Founders after 2026-05-31) set this to `false` without deleting
		 * the plan row.
		 */
		isActive: boolean;
		/** Marked as the anchor / recommended tier on the pricing page. PROFESIONAL at launch. */
		isPopular?: boolean;
		/**
		 * Visibility on the public pricing page. AVANZADO = `false` until
		 * ≥2 Planned features ship (per SUBSCRIPTION_TIERS_BEST_PRACTICES §0).
		 */
		isPublic: boolean;
		/** Stripe Price IDs once the plan is wired to Stripe Products (api#627). */
		stripeMonthlyPriceId?: string;
		stripeAnnualPriceId?: string;
		/**
		 * MercadoPago PreApprovalPlan IDs — populated by the future
		 * `seed-mercadopago-plans` Lambda (api#843). Coexist with the Stripe
		 * IDs above on the same Plan row so both providers' state can live
		 * in one place; unused fields stay dormant.
		 */
		mpPreApprovalPlanIdMonthly?: string;
		mpPreApprovalPlanIdAnnual?: string;
		/** Per-tier entitlement configuration. */
		entitlements: Record<FeatureKey, Entitlement>;
		createdAt: number;
		updatedAt: number;
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
		 * Founders cohort only — YYYY-MM-DD when the 12-month free PROFESIONAL
		 * entitlement window ends. Set on registration when `?mode=founders`
		 * is opted into and the cohort is open. String (not numeric ms) so it's
		 * human-readable in the DynamoDB console — matches api#802 verbatim.
		 */
		freeUntil?: string;
		/** Founders cohort only — YYYY-MM-DD when the post-free grace period ends. */
		graceUntil?: string;
		/** Founders cohort only — eligible for the perpetual founder discount after cutoff. */
		founderDiscountEligible?: boolean;
		/** Stripe identifiers (absent for trialing/fundador before checkout). */
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
		/** Period in YYYYMM format. */
		period: string;
		current: number;
		limit: number;
		remaining: number;
	}

	/**
	 * Full subscription snapshot pushed to the frontend on subscription/entitlement
	 * changes. Flat shape — matches GET /subscription wire format directly.
	 */
	interface SubscriptionSyncPayload {
		planTier: PlanTier;
		status: SubscriptionStatus;
		billingCycle: BillingCycle | null;
		currentPeriodStart: number | null;
		currentPeriodEnd: number | null;
		trialEndsAt: number | null;
		freeUntil?: string;
		cancelAt: number | null;
		canceledAt: number | null;
		entitlements: SubscriptionEntitlementEntry[];
		usage: SubscriptionUsageEntry[];
	}
}

export {};
