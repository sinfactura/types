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
// 61 variants:
//   - 1.6.11 (Phase 1, 17 variants) — MVP wire-ins covering the hot paths
//   - 1.6.12 (Phase 2, +32 variants) — full mutating admin-handler coverage
//   - 1.6.13 (Phase 3, +8 UI-only variants) — FE companion (app#1642, api#1247)
//   - 1.6.18 (+2 variants) — TOTP 2FA enroll/disable lifecycle (types#68, api#636)
//   - 1.6.20 (+1 variant) — operator 2FA reset, target_user_id (api#1335)
//   - 1.6.21 (+1 variant) — TOTP recovery codes generated (api#1336); method += 'recovery'

declare global {

	interface UserActivityEventBase {
		tenant_store_id: string;       // e.g. "STO002"
		user_id: string;               // actor — e.g. "USR000003"
		actor_role: 'USER' | 'ADMIN' | 'SUPERVISOR' | 'MANAGER';
		actor_full_name: string;       // denormalized at write time so rows survive renames
		actor_ip?: string;             // API Gateway sourceIp; absent for system-triggered actions
		event_id: string;              // UUID v4 (idempotency key)
		schema_version: 1;             // literal — bump on breaking change
		ts: string;                    // ISO 8601 with offset
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Phase 1 (1.6.11) — 17 variants
	// ──────────────────────────────────────────────────────────────────────────

	// Auth (4)

	interface UserLoggedInEvent extends UserActivityEventBase {
		event: 'User Logged In';
		method: 'password' | 'totp' | 'refresh' | 'social' | 'recovery';
	}

	interface UserLoggedOutEvent extends UserActivityEventBase {
		event: 'User Logged Out';
	}

	interface UserPasswordChangedEvent extends UserActivityEventBase {
		event: 'User Password Changed';
		target_user_id: string;        // may differ from `user_id` when an ADMIN resets another user's password
	}

	interface UserSuspendedEvent extends UserActivityEventBase {
		event: 'User Suspended';
		target_user_id: string;
		reason: string;
	}

	// TOTP 2FA lifecycle (1.6.18 — types#68, api#636). Enroll/Disable are
	// self-service, so `user_id` is both actor and target. Step-up login
	// success reuses `UserLoggedInEvent.method = 'totp'`; wrong-code attempts
	// go to the LOGIN# login-history partition, not this feed.

	interface TwoFactorEnrolledEvent extends UserActivityEventBase {
		event: 'Two-Factor Enrolled';
	}

	interface TwoFactorDisabledEvent extends UserActivityEventBase {
		event: 'Two-Factor Disabled';
	}

	// Operator account-recovery (1.6.20 — api#1335): a SUPERVISOR/MANAGER
	// clears a locked-out user's TOTP. Unlike Enroll/Disable this is an
	// operator-on-user action, so `target_user_id` is the reset user while
	// `user_id`/`actor_*` identify the operator.
	interface TwoFactorResetEvent extends UserActivityEventBase {
		event: 'Two-Factor Reset';
		target_user_id: string;
	}

	// Self-service recovery codes (1.6.21 — api#1336): the user mints a new set
	// of single-use backup codes, at enrollment or via the regenerate endpoint.
	// A recovery-code LOGIN is captured by `User Logged In` method:'recovery'
	// (no bespoke "code used" variant), mirroring how a TOTP login reuses
	// method:'totp'.
	interface TwoFactorRecoveryCodesGeneratedEvent extends UserActivityEventBase {
		event: 'Two-Factor Recovery Codes Generated';
		count: number;
		trigger: 'enrollment' | 'regenerate';
	}

	// Tenant config (3)

	interface StorePaletteChangedEvent extends UserActivityEventBase {
		event: 'Store Palette Changed';
		before: Record<string, unknown>;
		after: Record<string, unknown>;
	}

	interface StoreSettingsUpdatedEvent extends UserActivityEventBase {
		event: 'Store Settings Updated';
		section: string;
		before: Record<string, unknown>;
		after: Record<string, unknown>;
	}

	interface PlanChangedEvent extends UserActivityEventBase {
		event: 'Plan Changed';
		from_tier: string;
		to_tier: string;
	}

	// Business operations (4)

	interface InvoiceCreatedEvent extends UserActivityEventBase {
		event: 'Invoice Created';
		invoice_id: string;
		total: number;
		currency: string;
		type: string;
	}

	interface OrderCreatedEvent extends UserActivityEventBase {
		event: 'Order Created';
		order_id: string;
		total: number;
		currency: string;
	}

	interface OrderCancelledEvent extends UserActivityEventBase {
		event: 'Order Cancelled';
		order_id: string;
		reason: string;
	}

	// Per-price-list resolved-base before/after delta carried by
	// ProductPriceChangedEvent.changes (api#1419). Amounts are in the store's
	// display currency. snake_case to match the event-property convention.
	interface PriceListChange {
		list_id: number;
		from: number;
		to: number;
	}

	interface ProductPriceChangedEvent extends UserActivityEventBase {
		event: 'Product Price Changed';
		product_id: string;
		from_price: number;
		to_price: number;
		currency: string;
		// Per-price-list resolved-base deltas for the A-prime prices[] slot model
		// (api#1419). Optional + additive: the scalar from_price/to_price stay the
		// headline (the first changed list); legacy/scalar emits omit this.
		changes?: PriceListChange[];
	}

	// Customer lifecycle (2)

	interface CustomerCreatedEvent extends UserActivityEventBase {
		event: 'Customer Created';
		customer_id: string;
	}

	interface CustomerEditedEvent extends UserActivityEventBase {
		event: 'Customer Edited';
		customer_id: string;
		fields_changed: string[];
	}

	// Cash (2)

	interface CashDrawerOpenedEvent extends UserActivityEventBase {
		event: 'Cash Drawer Opened';
		cash_id: string;
		opening_balance: number;
		currency: string;
	}

	interface CashDrawerClosedEvent extends UserActivityEventBase {
		event: 'Cash Drawer Closed';
		cash_id: string;
		final_balance: number;
		discrepancy: number;
		currency: string;
	}

	// Platform-level — MANAGER actions (2)

	interface TenantImpersonatedEvent extends UserActivityEventBase {
		event: 'Tenant Impersonated';
		target_store_id: string;
		reason: string;
	}

	interface SecretRotatedEvent extends UserActivityEventBase {
		event: 'Secret Rotated';
		secret_name: string;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Phase 2 (1.6.12) — +32 variants, full admin mutating-handler coverage
	// ──────────────────────────────────────────────────────────────────────────

	// Auth (2)

	interface UserCreatedEvent extends UserActivityEventBase {
		event: 'User Created';
		target_user_id: string;
		target_user_roles: string[];
	}

	interface UserUpdatedEvent extends UserActivityEventBase {
		event: 'User Updated';
		target_user_id: string;
		fields_changed: string[];
	}

	// Catalog (7)

	interface ProductCreatedEvent extends UserActivityEventBase {
		event: 'Product Created';
		product_id: string;
		name: string;
	}

	interface ProductUpdatedEvent extends UserActivityEventBase {
		event: 'Product Updated';
		product_id: string;
		fields_changed: string[];
	}

	interface StockIncomeCreatedEvent extends UserActivityEventBase {
		event: 'Stock Income Created';
		product_id: string;
		quantity: number;
		cost: number;
		currency: string;
		supplier_id?: string;
	}

	interface CategoryCreatedEvent extends UserActivityEventBase {
		event: 'Category Created';
		category_id: string;
		name: string;
	}

	interface CategoryUpdatedEvent extends UserActivityEventBase {
		event: 'Category Updated';
		category_id: string;
		fields_changed: string[];
	}

	interface BrandCreatedEvent extends UserActivityEventBase {
		event: 'Brand Created';
		brand_id: string;
		name: string;
	}

	interface BrandUpdatedEvent extends UserActivityEventBase {
		event: 'Brand Updated';
		brand_id: string;
		fields_changed: string[];
	}

	// Suppliers (5)

	interface SupplierCreatedEvent extends UserActivityEventBase {
		event: 'Supplier Created';
		supplier_id: string;
		name: string;
	}

	interface SupplierUpdatedEvent extends UserActivityEventBase {
		event: 'Supplier Updated';
		supplier_id: string;
		fields_changed: string[];
	}

	interface SupplierInvoiceCreatedEvent extends UserActivityEventBase {
		event: 'Supplier Invoice Created';
		supplier_id: string;
		supplier_invoice_id: string;
		total: number;
		currency: string;
	}

	interface SupplierAccountCreatedEvent extends UserActivityEventBase {
		event: 'Supplier Account Created';
		supplier_id: string;
		account_id: string;
		currency: string;
	}

	interface SupplierAccountUpdatedEvent extends UserActivityEventBase {
		event: 'Supplier Account Updated';
		supplier_id: string;
		account_id: string;
		fields_changed: string[];
	}

	// Accounts + Baskets + Cash (5)

	interface AccountCreatedEvent extends UserActivityEventBase {
		event: 'Account Created';
		customer_id: string;
		account_id: string;
		currency: string;
		amount: number;
	}

	interface AccountDeletedEvent extends UserActivityEventBase {
		event: 'Account Deleted';
		customer_id: string;
		account_id: string;
	}

	interface BasketUpdatedEvent extends UserActivityEventBase {
		event: 'Basket Updated';
		customer_id: string;
		items_count: number;
		total: number;
	}

	interface BasketDeletedEvent extends UserActivityEventBase {
		event: 'Basket Deleted';
		customer_id: string;
	}

	interface CashDrawerMovementEvent extends UserActivityEventBase {
		event: 'Cash Drawer Movement';
		cash_id: string;
		direction: 'income' | 'outcome';
		amount: number;
		currency: string;
		concept: string;
	}

	// Payments (4)

	interface PaymentCreatedEvent extends UserActivityEventBase {
		event: 'Payment Created';
		payment_id: string;
		provider: 'mercadopago' | 'stripe';
		amount: number;
		currency: string;
	}

	interface PaymentLinkedEvent extends UserActivityEventBase {
		event: 'Payment Linked';
		payment_id: string;
		source: 'mp' | 'stripe' | 'mp_movement';
		target_type: 'customer' | 'order' | 'account';
		target_id: string;
	}

	interface PaymentUnlinkedEvent extends UserActivityEventBase {
		event: 'Payment Unlinked';
		payment_id: string;
		source: 'mp' | 'stripe' | 'mp_movement';
	}

	interface PaymentLinkageUpdatedEvent extends UserActivityEventBase {
		event: 'Payment Linkage Updated';
		payment_id: string;
		before: Record<string, unknown>;
		after: Record<string, unknown>;
	}

	// Notifications / Logs / Plans (3)

	interface NotificationReadEvent extends UserActivityEventBase {
		event: 'Notification Read';
		notification_id?: string;
		bulk: boolean;
		read_count?: number;
	}

	interface LogDeletedEvent extends UserActivityEventBase {
		event: 'Log Deleted';
		log_mode: string;
		deleted_count: number;
	}

	interface PlanCreatedEvent extends UserActivityEventBase {
		event: 'Plan Created';
		tier: string;
		name: string;
	}

	// Store / Platform / Tenant (4)

	interface StoreMaintenanceToggledEvent extends UserActivityEventBase {
		event: 'Store Maintenance Toggled';
		enabled: boolean;
		reason?: string;
	}

	interface PlatformMaintenanceToggledEvent extends UserActivityEventBase {
		event: 'Platform Maintenance Toggled';
		enabled: boolean;
		reason?: string;
	}

	interface TenantCreatedEvent extends UserActivityEventBase {
		event: 'Tenant Created';
		target_store_id: string;
		name: string;
	}

	interface LiteralUpdatedEvent extends UserActivityEventBase {
		event: 'Literal Updated';
		key: string;
		before: string;
		after: string;
	}

	// Support (2)

	interface SupportTicketCreatedEvent extends UserActivityEventBase {
		event: 'Support Ticket Created';
		ticket_id: string;
		subject: string;
	}

	interface SupportTicketUpdatedEvent extends UserActivityEventBase {
		event: 'Support Ticket Updated';
		ticket_id: string;
		fields_changed: string[];
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Phase 3 (1.6.13) — +8 UI-only variants emitted by the FE companion
	// (`app#1642`) via the dedicated ingest endpoint (`api#1247`).
	//
	// Distinct from Phase 1/2 variants which originate from BE mutating
	// handlers. UI-only variants are gated on the api side by an explicit
	// whitelist (`UI_ONLY_USER_ACTIVITY_VARIANTS` below) so the FE cannot
	// spoof emissions that should only come from BE-side mutations.
	// ──────────────────────────────────────────────────────────────────────────

	// Meta + read-side audit (3) — Argentine regulator expectations include
	// meta-audit of audit-log views and PII reveals.

	interface AuditTrailViewedEvent extends UserActivityEventBase {
		event: 'Audit Trail Viewed';
		scope: 'tenant' | 'platform';
		filters?: Record<string, unknown>;
	}

	interface ReportViewedEvent extends UserActivityEventBase {
		event: 'Report Viewed';
		report_id: string;
		report_name: string;
	}

	interface CustomerPiiViewedEvent extends UserActivityEventBase {
		event: 'Customer PII Viewed';
		customer_id: string;
		// Explicit list of fields the operator unmasked (e.g. ['cuit', 'email']).
		// FE only emits on explicit reveal-click — not on every detail pane open.
		fields_revealed: string[];
	}

	// Cash drawer UI lifecycle (2) — distinct from the BE `Cash Drawer
	// Opened/Closed` variants which record the POST mutation. These record
	// the UI act of opening/closing the drawer panel.

	interface CashDrawerUiOpenedEvent extends UserActivityEventBase {
		event: 'Cash Drawer UI Opened';
		cash_id: string;
	}

	interface CashDrawerUiClosedEvent extends UserActivityEventBase {
		event: 'Cash Drawer UI Closed';
		cash_id: string;
	}

	// Export (1)

	interface ExportInitiatedEvent extends UserActivityEventBase {
		event: 'Export Initiated';
		format: 'csv' | 'pdf' | 'xlsx';
		entity_type: string;       // e.g. 'customers', 'orders', 'invoices'
		row_count: number;
	}

	// Impersonation UI lifecycle (2) — distinct from the BE-side
	// `Tenant Impersonated` which records the POST that mints the
	// impersonation token. These bracket the FE-side session.

	interface ImpersonationUiStartedEvent extends UserActivityEventBase {
		event: 'Impersonation UI Started';
		target_store_id: string;
	}

	interface ImpersonationUiEndedEvent extends UserActivityEventBase {
		event: 'Impersonation UI Ended';
		target_store_id: string;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Phase 4 (1.6.23 — api#1266) — +11 interaction-coverage variants. FE-emitted
	// (UI-only) via the api#1247 ingest endpoint; `Action Denied` is ALSO written
	// BE-side on a real 403 (the FE emits only its own pre-roundtrip
	// maintenance/subscription/permission denials). Grooming: app#1653 /
	// app/docs/research/AUDIT_INTERACTION_COVERAGE.md.
	//
	// PII guarantees: `Search Performed` carries `query_hash` only (raw text never
	// leaves the client); `Two-Factor Recovery Codes Revealed` carries `code_count`
	// only (never the codes); `Action Denied.attempted_action` is a stable verb id;
	// every `*_id` is an opaque entity id — no name/email/CUIT/phone anywhere.
	// ──────────────────────────────────────────────────────────────────────────

	// Sensitive views (4)
	interface PaymentViewedEvent extends UserActivityEventBase {
		event: 'Payment Viewed';
		payment_id: string;
		source?: string;
		linked_status?: 'linked' | 'unlinked';
	}

	interface InvoiceViewedEvent extends UserActivityEventBase {
		event: 'Invoice Viewed';
		invoice_id: string;
		fiscal_status?: string;
	}

	interface CustomerDetailViewedEvent extends UserActivityEventBase {
		event: 'Customer Detail Viewed';
		customer_id: string;
	}

	interface SupplierAccountViewedEvent extends UserActivityEventBase {
		event: 'Supplier Account Viewed';
		supplier_id: string;
	}

	// Search (1) — scope-tagged; query HASHED, never raw (Ley 25.326)
	interface SearchPerformedEvent extends UserActivityEventBase {
		event: 'Search Performed';
		scope: 'customers' | 'audit' | 'suppliers' | 'invoices' | 'payments';
		query_hash?: string; // SHA-256 of the normalized query; omitted when empty/cleared
		result_count?: number; // count only — never the result identities
	}

	// Denied (1) — forensic headline. BE writes the 403 row; FE writes its own
	// pre-roundtrip denials (maintenance/subscription/permission short-circuits).
	interface ActionDeniedEvent extends UserActivityEventBase {
		event: 'Action Denied';
		attempted_action: string; // stable verb id, e.g. 'order.status.advance'
		resource_type: string; // 'order' | 'customer' | 'payment' | 'cash' | …
		resource_id?: string; // present when the gate guards a specific entity
		reason: 'permission' | 'subscription' | 'maintenance';
	}

	// 2FA / auth step-up (5)
	interface TwoFactorChallengeShownEvent extends UserActivityEventBase {
		event: 'Two-Factor Challenge Shown';
		method: 'password' | 'social';
		provider?: string;
	}

	interface TwoFactorCodeValidationFailedEvent extends UserActivityEventBase {
		event: 'Two-Factor Code Validation Failed';
		method: 'totp' | 'recovery';
		attempt_number?: number;
	}

	interface TwoFactorEnrollmentStartedEvent extends UserActivityEventBase {
		event: 'Two-Factor Enrollment Started';
	}

	interface TwoFactorRecoveryCodesRevealedEvent extends UserActivityEventBase {
		event: 'Two-Factor Recovery Codes Revealed';
		code_count: number; // count only — NEVER the codes
	}

	interface TwoFactorResetInitiatedEvent extends UserActivityEventBase {
		event: 'Two-Factor Reset Initiated';
		target_user_id: string;
		initiator_role: string;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Discriminated union — 68 variants
	// ──────────────────────────────────────────────────────────────────────────

	type UserActivityEvent =
		// Phase 1
		| UserLoggedInEvent
		| UserLoggedOutEvent
		| UserPasswordChangedEvent
		| UserSuspendedEvent
		// TOTP 2FA (1.6.18 — types#68)
		| TwoFactorEnrolledEvent
		| TwoFactorDisabledEvent
		| TwoFactorResetEvent
		| TwoFactorRecoveryCodesGeneratedEvent
		| StorePaletteChangedEvent
		| StoreSettingsUpdatedEvent
		| PlanChangedEvent
		| InvoiceCreatedEvent
		| OrderCreatedEvent
		| OrderCancelledEvent
		| ProductPriceChangedEvent
		| CustomerCreatedEvent
		| CustomerEditedEvent
		| CashDrawerOpenedEvent
		| CashDrawerClosedEvent
		| TenantImpersonatedEvent
		| SecretRotatedEvent
		// Phase 2
		| UserCreatedEvent
		| UserUpdatedEvent
		| ProductCreatedEvent
		| ProductUpdatedEvent
		| StockIncomeCreatedEvent
		| CategoryCreatedEvent
		| CategoryUpdatedEvent
		| BrandCreatedEvent
		| BrandUpdatedEvent
		| SupplierCreatedEvent
		| SupplierUpdatedEvent
		| SupplierInvoiceCreatedEvent
		| SupplierAccountCreatedEvent
		| SupplierAccountUpdatedEvent
		| AccountCreatedEvent
		| AccountDeletedEvent
		| BasketUpdatedEvent
		| BasketDeletedEvent
		| CashDrawerMovementEvent
		| PaymentCreatedEvent
		| PaymentLinkedEvent
		| PaymentUnlinkedEvent
		| PaymentLinkageUpdatedEvent
		| NotificationReadEvent
		| LogDeletedEvent
		| PlanCreatedEvent
		| StoreMaintenanceToggledEvent
		| PlatformMaintenanceToggledEvent
		| TenantCreatedEvent
		| LiteralUpdatedEvent
		| SupportTicketCreatedEvent
		| SupportTicketUpdatedEvent
		// Phase 3 (UI-only — emitted via api#1247 ingest endpoint)
		| AuditTrailViewedEvent
		| ReportViewedEvent
		| CustomerPiiViewedEvent
		| CashDrawerUiOpenedEvent
		| CashDrawerUiClosedEvent
		| ExportInitiatedEvent
		| ImpersonationUiStartedEvent
		| ImpersonationUiEndedEvent
		// Phase 4 (api#1266 — interaction coverage)
		| PaymentViewedEvent
		| InvoiceViewedEvent
		| CustomerDetailViewedEvent
		| SupplierAccountViewedEvent
		| SearchPerformedEvent
		| ActionDeniedEvent
		| TwoFactorChallengeShownEvent
		| TwoFactorCodeValidationFailedEvent
		| TwoFactorEnrollmentStartedEvent
		| TwoFactorRecoveryCodesRevealedEvent
		| TwoFactorResetInitiatedEvent;

}

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
	// Phase 4 (api#1266) — FE emits each through the ingest gate. `Action Denied`
	// is whitelisted for the FE-gate path (pre-roundtrip maintenance/subscription/
	// permission denials); the real BE 403 row is written server-side, not POSTed.
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
] as const;

export type UiOnlyUserActivityVariant = (typeof UI_ONLY_USER_ACTIVITY_VARIANTS)[number];

/**
 * Valid per-entity timeline entity types for the user-activity audit feed.
 * MUST stay in sync with the BE `VALID_ENTITY_TYPES` const in
 * `sinfactura/api/stacks/lambdas/userActivity/_get.ts` (api#1258), which Zod-
 * enums the `entityType` query param. The api should import this union to
 * derive that const so the two can't drift (separate api follow-up).
 */
export type UserActivityEntityType =
	| 'order'
	| 'invoice'
	| 'supplier_invoice'
	| 'payment'
	| 'account'
	| 'customer'
	| 'supplier'
	| 'product'
	| 'user'
	| 'target_store'
	| 'brand'
	| 'category'
	| 'cash'
	| 'ticket'
	| 'report'
	| 'notification';
