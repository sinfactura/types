// Actor-centric audit trail, distinct from the entity-centric `AUDIT#{entity}#{entityId}`
// rows in `sinfactura/api/stacks/services/audit.ts`; emitted via the `recordUserActivity`
// synchronous helper at the end of mutating REST handlers.
//
// Naming follows `StorefrontEvent`'s convention: Title Case Object + Past-Tense Action for
// event names, snake_case for properties.
//
// Distinct from `StorefrontEvent`: subject is internal staff (USER/ADMIN/SUPERVISOR/MANAGER) or
// the PRINTER machine identity (a Cloud Print agent), never anonymous; retention is 90d hot +
// multi-year archive; append-only / anti-erasure per Ley 25.326 audit-trail exemption; ingest is
// synchronous only (WS ingest disallowed).
/**
 * Canonical whitelist of UI-only `UserActivityEvent` variant names. Imported by
 * the api side (`POST /audit/user-activity`) to gate the FE-ingest endpoint:
 * any `event` value NOT in this set originates from a BE mutating handler and
 * must be rejected to prevent the FE from spoofing audit emissions.
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
    // `Action Denied` is whitelisted for the FE-gate path (pre-roundtrip
    // maintenance/subscription/permission denials); the real BE 403 row is
    // written server-side, not POSTed.
    'Payment Viewed',
    'Invoice Viewed',
    'Customer Detail Viewed',
    'Supplier Account Viewed',
    'Search Performed',
    'Action Denied',
    'Two-Factor Challenge Shown',
    'Two-Factor Code Validation Failed',
    'Two-Factor Enrollment Started',
    'Two-Factor Recovery Codes Revealed',
    'Two-Factor Reset Initiated',
];
