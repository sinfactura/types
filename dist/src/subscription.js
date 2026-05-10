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
export {};
