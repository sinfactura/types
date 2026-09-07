/**
 * Subscription types — plan tiers, entitlements, feature matrix, subscription state.
 *
 * Ships Chunk 1. Canonical decisions live in
 * sinfactura/app/docs/plans/SUBSCRIPTION_BUSINESS_DECISIONS.md and
 * sinfactura/app/docs/adr/0010-launch-trial-policy.md.
 *
 * Notes:
 * - Tier names are the 4 locked Spanish tiers (per SUBSCRIPTION_TIERS_BEST_PRACTICES §0):
 *   BÁSICO, EMPRENDEDOR, PROFESIONAL, AVANZADO. The launch policy
 *   (ADR-0010) gives every new paid subscription a 30-day Stripe trial; courtesy
 *   gifts (formerly the Founders cohort) are now a one-off ops action via
 *   `gift-subscription` that sets `freeUntil` on the SUBSCRIPTION row.
 * - `freeUntil` lives on every Subscription independent of status. It is the
 *   courtesy-gift cutoff; while `freeUntil > now` the BE suppresses billing.
 * - `FeatureKey` uses flat camelCase (not the dotted `reports.advanced` from the design kit).
 * - Monetary amounts are integers in minor units (ARS cents) to avoid float issues.
 * - Feature keys now match the BE wire format directly (renamed afip→afipInvoicing,
 *   cash→cashManagement, reportsAdvanced→advancedReports as of 2026-04-26). The interim
 *   paymentIntegrations key was split into domesticPayments + stripePayments.
 *   New keys whatsappCommerce/aiFeatures/mobileApp/customDomain are
 *   declared here even when their epics haven't shipped — the matrix can set
 *   enabled:false until they do.
 */
declare global {
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
    type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'readonly' | 'canceled';
    type BillingCycle = 'monthly' | 'annual';
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
    /**
     * All gated features. Add new keys here when a new feature becomes gateable;
     * every existing plan in `FEATURE_MATRIX` must then declare the new key
     * (TypeScript enforces this via `Record<FeatureKey, Entitlement>`).
     *
     * ⚠️ **`Record<FeatureKey, …>` is NOT the only construction a new member
     * breaks, and searching for it alone will tell you a consumer is unaffected
     * when it is not.** Measured: a grep for `Record<FeatureKey` across the api
     * returned only a type alias, which was reported as "adding a key is a no-op
     * here" — and the very next `typecheck` failed with
     * `Type '"marketing"' does not satisfy the constraint 'never'`, from an
     * exhaustiveness tripwire written as `Exclude<FeatureKey, (typeof KEYS)[number]>`
     * against a literal tuple. Enumerate the FORMS, not one spelling of them:
     * `Record<>`, `Exclude<>` against a tuple, a switch, an array literal whose
     * length is asserted.
     *
     * ⚠️ **And a new member can be a WIRE change, not merely a wider type.** A
     * consumer that validates a seed payload against the key count — the api does,
     * with an exact `.length(FEATURE_KEYS.length)` — starts rejecting every
     * payload written against the previous length the moment this union grows.
     * That is deliberate there (loud at the seeding call, rather than a tier
     * quietly missing a feature), but it means the caller must be updated in the
     * same change. Adding a key is never only additive downstream.
     */
    type FeatureKey = 'maxOrdersMonth' | 'maxInvoicesMonth' | 'maxProducts' | 'maxUsers' | 'maxCustomers' | 'maxStores' | 'priceListsMax' | 'afipInvoicing' | 'suppliers' | 'domesticPayments' | 'stripePayments' | 'cashManagement' | 'multiStore' | 'importExport' | 'advancedReports' | 'customBranding' | 'apiAccess' | 'prioritySupport' | 'whatsappCommerce' | 'aiFeatures' | 'mobileApp' | 'customDomain' | 'advancedPricing' | 'marketplaceChannels' | 'storefront' | 'loyalty' | 'marketing';
    /** Full feature matrix — every tier declares every feature. */
    type FeatureMatrix = Record<PlanTier, Record<FeatureKey, Entitlement>>;
    /** Resolved entitlements for a specific tenant (matrix + overrides applied). */
    type ResolvedEntitlements = Record<FeatureKey, Entitlement>;
    /**
     * One entitlement exactly as the api's resolver emits it, with no wire
     * normalization applied.
     *
     * ⚠️ Do NOT unify this with `Entitlement`. The two describe the same concept
     * at two different points on the wire, and collapsing them re-breaks whichever
     * consumer sits on the other side. `GET /subscription` pushes the resolver's
     * output through `?? null` on its way into `SubscriptionEntitlementEntry`, so
     * an absence surfaces there as an explicit null;
     * `GET /platform/stores/{storeId}/overrides` returns the resolver's bundle
     * verbatim, so an absence surfaces here as a missing key. A consumer holding
     * the nullable spelling waits for a null that never arrives and walks straight
     * into the `undefined` that does.
     *
     * A boolean feature carries no `limit` and a numeric/metered one carries no
     * `enabled` — the plan editor rejects the opposite pairing outright. The lone
     * exception is a deleted tenant, whose deny-everything bundle stamps every key
     * as boolean/false/0 no matter what type that key really has.
     *
     * `source` is never absent here (the resolver stamps it on both its branches)
     * and never `'trial'`: a trial is a subscription status, not an origin an
     * entitlement can be resolved from, and nothing in the resolver emits it.
     */
    interface ResolvedEntitlementEntry {
        type: EntitlementType;
        enabled?: boolean;
        limit?: number;
        source: 'plan' | 'override';
    }
    /**
     * What a tenant actually gets once plan defaults and overrides are merged —
     * the resolver's entire return value, not just its feature map. The tier and
     * status travel with it because a resolved entitlement cannot be explained to
     * an operator without them.
     *
     * ⚠️ `entitlements` is PARTIAL over `FeatureKey`, and the gaps are routine
     * rather than theoretical: a key appears only once the tenant's tier owns a
     * PLAN row for it, so a feature published ahead of its plan-row backfill is
     * missing for every tenant alive. Indexing through without a guard is a
     * runtime TypeError on precisely the tenants a new feature has not reached.
     */
    interface StoreEntitlementsBundle {
        planTier: PlanTier;
        status: SubscriptionStatus;
        entitlements: Partial<Record<FeatureKey, ResolvedEntitlementEntry>>;
    }
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
     * `GET /subscription/plans`. Source of truth lives in
     * DynamoDB (`PLAN#{tier}` partition), administered via `POST /sa/plans`
     * + `PATCH /sa/plans/{tier}`.
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
     * Added:
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
         * subscribers. Pre-launch / sales-led tiers set this `false` without
         * deleting the row.
         */
        isActive: boolean;
        /**
         * Anchor/recommended tier on the pricing page (renders the "Más elegido"
         * pill). Not enforced unique by the BE — canonical convention is exactly one.
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
         * is the migration target. `null` on free/off-billing tiers (basico).
         */
        currency: 'ARS' | 'USD' | null;
        /**
         * Single brand hex color (e.g. '#590d82'); FE derives `soft`/`border`
         * shades via MUI's `alpha()`. `null` on plans seeded before the color backfill.
         */
        color: string | null;
        /**
         * Per-feature configuration. Every `FeatureKey` appears exactly once.
         * Boolean features carry `enabled`; numeric/metered carry `limit`.
         */
        features: PlanFeature[];
        /**
         * Marketing-curated short bullets for the pricing card. Display order =
         * array order; up to 6 entries, 80 chars each. Always present — empty array
         * when unset (FE synthesizes a list from `features[]`). Lets marketing tweak
         * copy via `/sa/plans` without a redeploy; replaces the FE-only `BULLET_LIST_BY_TIER`.
         */
        bullets: string[];
    }
    /**
     * One audit row per SUPER_ADMIN-driven plan mutation, returned by
     * `GET /platform/billing/plans/{tier}/audit`. The store-subscription audit
     * shares this storage shape but is read as `SubscriptionAuditEntry`.
     * `before`/`after` carry only the fields that changed (diff slice).
     */
    interface PlanAuditEntry {
        entity: 'PLAN';
        entityId: string;
        timestamp: number;
        actor: {
            userId: string;
            fullName: string;
        };
        action: string;
        before: Record<string, unknown>;
        after: Record<string, unknown>;
        reason: string;
        createdAt: number;
    }
    /**
     * @deprecated LEGACY DECLARATION — this does NOT match the api's stored
     * subscription row, and no api code references it. The real row keys on
     * `storeId` (not `tenantId`), leaves `billingCycle`/`currentPeriodStart`/
     * `currentPeriodEnd` unset until checkout completes, uses provider-neutral
     * `externalCustomerId`/`externalSubscriptionId` (not the Stripe-named pair),
     * stores overrides as separate `OVERRIDE#…` rows (not an embedded map), and
     * additionally carries `provider`, `cancelAt`, `canceledAt` and
     * `pastDueSince`. Storage stays api-internal; read subscription state
     * through `SubscriptionSyncPayload` (`GET /subscription`), and expect the
     * WebSocket to deliver only `{ action: 'subscription', data: { type } }`
     * refetch nudges, never this object.
     */
    interface Subscription {
        tenantId: string;
        planTier: PlanTier;
        status: SubscriptionStatus;
        billingCycle: BillingCycle;
        /**
         * Declared here but NEVER stored on the subscription row — the api's row
         * has no `currency` member. The wire `currency` in
         * `SubscriptionSyncPayload` is read from the Plan template at
         * response-build time, not snapshotted onto the subscription.
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
    /**
     * Per-tenant, per-period usage counters for `metered` features. Monthly reset
     * via scheduled Lambda. At launch, used only for local enforcement;
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
        /**
         * The plan the tenant was on when the subscription was canceled — the
         * plan they lost. Set by both cancel paths (provider
         * `subscription.canceled` and the grace sweep) before `planTier` is
         * reset to the free tier; cleared (to `null`) when the tenant
         * re-subscribes to a paid tier. `null` on rows canceled before this
         * field existed — forward-only, readers fall back to generic copy.
         */
        canceledFromTier?: PlanTier | null;
        entitlements: SubscriptionEntitlementEntry[];
        usage: SubscriptionUsageEntry[];
    }
    /**
     * Compact subscription summary attached to `Store.subscription` on
     * `GET /tenants` (list) and `GET /tenants?storeId=X` (single-store)
     * responses. Absent entirely on a store with no SUBSCRIPTION row.
     *
     * This is the STORE-LIST row, not the whole of what SUPERVISOR may read. The
     * cross-tenant billing roll-up behind `GET /tenants/billing`
     * (`TenantBillingRollupRow`) is supervisorToken too and is deliberately
     * wider: a billing grid that cannot show what a tenant was charged is not a
     * billing grid, so amounts and live provider history are emitted there. What
     * stays MANAGER-only is the audit/override surface — reading who changed a
     * subscription out of band, and changing it.
     *
     * Least-privilege did not die, it moved. The widening adds AMOUNTS and adds
     * no provider IDENTIFIERS: `externalCustomerId`, `externalSubscriptionId`,
     * `stripeCustomerId`, `stripeSubscriptionId` and every token or secret stay
     * unemittable on both types, and the roll-up reads those ids only to decide
     * whether a provider round-trip is worth making. Two ways to misread that,
     * both seen: treating the roll-up's amounts as a leak because this type
     * forbids them, and widening THIS type toward the roll-up — a store list
     * renders for every tenant on every page load and has no reason to carry
     * money.
     */
    interface StoreRowSubscriptionSummary {
        planTier: PlanTier;
        status: SubscriptionStatus;
        /** `null` when the row has no billing cycle yet (pre-checkout). */
        billingCycle: BillingCycle | null;
        /** Courtesy-gift cutoff (ADR-0010). `YYYY-MM-DD`, matches `Subscription.freeUntil` — not epoch ms. */
        freeUntil?: string;
        /** Unix ms. Only meaningful while `status === 'trialing'`. */
        trialEndsAt?: number;
        currentPeriodEnd?: number;
    }
    /**
     * Request body for the MANAGER out-of-band override
     * `PUT /platform/stores/{storeId}/subscription`. No Stripe call — a direct
     * DynamoDB write + audit row. `trialEndsAt` is required (non-null) when
     * `status === 'trialing'`; `reason` is the audit message (min 10 chars).
     * `freeUntil`/`trialEndsAt` are three-state: omit to leave untouched,
     * `null` to clear, or a value to set.
     */
    interface SubscriptionAdminOverrideInput {
        planTier: PlanTier;
        status: SubscriptionStatus;
        billingCycle: BillingCycle;
        /** Courtesy-gift cutoff (ADR-0010), `YYYY-MM-DD`. Optional on any status; `null` clears it. */
        freeUntil?: string | null;
        /** Trial end (Unix ms). Required (non-null) when `status === 'trialing'`; `null` clears it otherwise. */
        trialEndsAt?: number | null;
        reason: string;
    }
    /**
     * One audit row for a MANAGER out-of-band subscription change, as returned by
     * `GET /platform/stores/{storeId}/subscription/audit`. Written by
     * the override endpoint and the gift endpoint to the
     * `AUDIT#SUBSCRIPTION#{storeId}` partition. `before`/`after` carry the
     * subscription fields an operator can change.
     */
    interface SubscriptionAuditEntry {
        storeId: string;
        timestamp: number;
        actor: {
            userId: string;
            fullName: string;
        };
        before: Pick<Subscription, 'planTier' | 'status' | 'billingCycle' | 'freeUntil' | 'trialEndsAt'>;
        after: Pick<Subscription, 'planTier' | 'status' | 'billingCycle' | 'freeUntil' | 'trialEndsAt'>;
        reason: string;
    }
    /**
     * One charge SINFACTURA made against a tenant, normalized out of whichever
     * billing provider holds the money. Backs the per-tenant payment history and
     * the `invoices` array on the cross-tenant `TenantBillingRollupRow`.
     *
     * ⚠️ NOT the fiscal `Invoice` entity, despite the name. That one is an
     * AFIP/ARCA comprobante a tenant issues to THEIR customer and is stored;
     * this one is what the tenant paid US. Subscription billing persists status
     * only — no amount, no charge id — so nothing here comes off a row: every
     * field is read live from the provider at request time. The two never
     * reconcile and must not be joined.
     */
    interface InvoiceSummary {
        id: string;
        /** Smallest currency unit (cents/centavos), never a decimal — dividing twice is the tell. */
        amount: number;
        currency: string;
        status: 'paid' | 'open' | 'void' | 'failed';
        /** Unix ms the invoice was issued / the charge was attempted. */
        issuedAt: number;
        /**
         * Provider-hosted PDF or hosted-invoice page. Optional because not every
         * provider mints one — render the row without a link rather than treating
         * its absence as a broken charge.
         */
        pdfUrl?: string;
    }
}
export {};
