// Typed user activity audit pipeline (types#70, api#1244).
//
// Actor-centric audit trail companion to the entity-centric `AUDIT#{entity}#{entityId}`
// rows authored in `sinfactura/api/stacks/services/audit.ts`. Schema mirrored in
// `sinfactura/api/stacks/helpers/userActivity/schema.ts`; emitted via the
// `recordUserActivity` synchronous helper at the end of mutating REST handlers.
//
// Naming follows the same convention as `StorefrontEvent` (types#69): Title Case
// Object + Past-Tense Action for event names, snake_case for properties.
//
// Distinct from `StorefrontEvent` (types#69):
//   - Subject: internal staff (USER/ADMIN/SUPERVISOR/MANAGER), never anonymous
//   - Retention: 90d hot + multi-year archive (vs 30d hot + 90d archive)
//   - Erasure: append-only / anti-erasure per Ley 25.326 audit-trail exemption
//   - Ingest: synchronous REST-handler helper (WS ingest explicitly disallowed)
//
// 57 variants:
//   - 1.6.11 (Phase 1, 17 variants) — MVP wire-ins covering the hot paths
//   - 1.6.12 (Phase 2, +32 variants) — full mutating admin-handler coverage
//   - 1.6.13 (Phase 3, +8 UI-only variants) — FE companion (app#1642, api#1247)
/**
 * Canonical whitelist of UI-only `UserActivityEvent` variant names — the 8
 * Phase 3 verbs shipped in 1.6.13 (types#74). Imported by the api side
 * (`POST /audit/user-activity`, api#1247) to gate the FE-ingest endpoint:
 * any `event` value NOT in this set originates from a BE mutating handler
 * and must be rejected to prevent the FE from spoofing audit emissions.
 *
 * Source of truth lives here so the api whitelist can't drift from the
 * actual UI-only variant taxonomy.
 */
export const UI_ONLY_USER_ACTIVITY_VARIANTS = [
    'Audit Trail Viewed',
    'Report Viewed',
    'Customer PII Viewed',
    'Cash Drawer UI Opened',
    'Cash Drawer UI Closed',
    'Export Initiated',
    'Impersonation UI Started',
    'Impersonation UI Ended',
];
