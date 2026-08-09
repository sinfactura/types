// Actor-centric audit trail, distinct from the entity-centric `AUDIT#{entity}#{entityId}`
// rows in `sinfactura/api/stacks/services/audit.ts`; emitted via the `recordUserActivity`
// synchronous helper at the end of mutating REST handlers.
//
// Naming follows `StorefrontEvent`'s convention: Title Case Object + Past-Tense Action for
// event names, snake_case for properties.
//
// Distinct from `StorefrontEvent`: subject is internal staff (USER/ADMIN/SUPERVISOR/MANAGER),
// never anonymous; retention is 90d hot + multi-year archive; append-only / anti-erasure per
// Ley 25.326 audit-trail exemption; ingest is synchronous only (WS ingest disallowed).

declare global {

	interface UserActivityEventBase {
		tenant_store_id: string;
		user_id: string;
		actor_role: 'USER' | 'ADMIN' | 'SUPERVISOR' | 'MANAGER';
		actor_full_name: string;       // denormalized at write time so rows survive renames
		actor_ip?: string;             // API Gateway sourceIp; absent for system-triggered actions
		event_id: string;              // UUID v4 (idempotency key)
		schema_version: 1;             // literal — bump on breaking change
		ts: string;                    // ISO 8601 with offset
	}

	// Phase 1 (1.6.11) — 17 variants

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

	// TOTP 2FA lifecycle (1.6.18): Enroll/Disable are self-service (`user_id` is
	// both actor and target). Step-up login success reuses
	// `UserLoggedInEvent.method = 'totp'`; wrong-code attempts go to the LOGIN#
	// login-history partition, not this feed.

	interface TwoFactorEnrolledEvent extends UserActivityEventBase {
		event: 'Two-Factor Enrolled';
	}

	interface TwoFactorDisabledEvent extends UserActivityEventBase {
		event: 'Two-Factor Disabled';
	}

	// Operator account-recovery (1.6.20): a SUPERVISOR/MANAGER clears a
	// locked-out user's TOTP. `target_user_id` is the reset user; `user_id`/
	// `actor_*` identify the operator.
	interface TwoFactorResetEvent extends UserActivityEventBase {
		event: 'Two-Factor Reset';
		target_user_id: string;
	}

	// Self-service recovery codes (1.6.21): mints a new set of single-use
	// backup codes at enrollment or via the regenerate endpoint. A
	// recovery-code LOGIN is captured by `User Logged In` method:'recovery'
	// (no bespoke "code used" variant).
	interface TwoFactorRecoveryCodesGeneratedEvent extends UserActivityEventBase {
		event: 'Two-Factor Recovery Codes Generated';
		count: number;
		trigger: 'enrollment' | 'regenerate';
	}

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

	/** An operator replaced an order's content under optimistic concurrency. */
	interface OrderEditedEvent extends UserActivityEventBase {
		event: 'Order Edited';
		order_id: string;
		/** Server-recomputed totals, in the order's own currency. */
		old_total: number;
		new_total: number;
		/** Count of lines added / removed / quantity-or-price changed. */
		lines_added: number;
		lines_removed: number;
		lines_modified: number;
	}

	/** An operator processed a full or partial return. */
	interface OrderReturnedEvent extends UserActivityEventBase {
		event: 'Order Returned';
		order_id: string;
		return_id: string;
		/** Credited amount — the discounted `Return.total`. */
		total: number;
		/** Number of original order lines involved. */
		line_count: number;
		reason: ReturnReason;
		/** True when at least one line came back as `damaged` (no restock). */
		has_damaged: boolean;
		/** NC lifecycle at the moment the return committed. */
		nc_status: ReturnCreditNoteStatus;
	}

	// Per-price-list resolved-base before/after delta carried by
	// ProductPriceChangedEvent.changes. Amounts are in the store's display
	// currency.
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
		// Optional + additive: from_price/to_price stay the headline (the first
		// changed list); legacy/scalar emits omit this.
		changes?: PriceListChange[];
	}

	interface CustomerCreatedEvent extends UserActivityEventBase {
		event: 'Customer Created';
		customer_id: string;
	}

	interface CustomerEditedEvent extends UserActivityEventBase {
		event: 'Customer Edited';
		customer_id: string;
		fields_changed: string[];
	}

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

	interface TenantImpersonatedEvent extends UserActivityEventBase {
		event: 'Tenant Impersonated';
		target_store_id: string;
		reason: string;
	}

	interface SecretRotatedEvent extends UserActivityEventBase {
		event: 'Secret Rotated';
		secret_name: string;
	}

	// Phase 2 (1.6.12) — +32 variants, full admin mutating-handler coverage

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

	// `LITERALS` row SK scope: per-surface defaults (GLOBAL/APP/PLATFORM/WEB)
	// plus per-tenant overrides (APP#{storeId}/WEB#{storeId}). Shared by the
	// GET surface→SK merge chain, POST scope write-gate, and the audit event below.
	type LiteralScope = 'GLOBAL' | 'APP' | 'PLATFORM' | 'WEB' | `APP#${string}` | `WEB#${string}`;

	interface LiteralUpdatedEvent extends UserActivityEventBase {
		event: 'Literal Updated';
		scope: LiteralScope;
		key: string;
		before: string;
		after: string;
	}

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

	// Phase 3 (1.6.13) — +8 UI-only variants emitted by the FE companion via
	// the dedicated ingest endpoint. UI-only variants are gated on the api
	// side by an explicit whitelist (`UI_ONLY_USER_ACTIVITY_VARIANTS` below)
	// so the FE cannot spoof emissions that should only come from BE-side
	// mutations.

	// Meta + read-side audit: Argentine regulator expectations include
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

	// Cash drawer UI lifecycle: distinct from the BE `Cash Drawer
	// Opened/Closed` variants (which record the POST mutation) — these record
	// the UI act of opening/closing the drawer panel.

	interface CashDrawerUiOpenedEvent extends UserActivityEventBase {
		event: 'Cash Drawer UI Opened';
		cash_id: string;
	}

	interface CashDrawerUiClosedEvent extends UserActivityEventBase {
		event: 'Cash Drawer UI Closed';
		cash_id: string;
	}

	interface ExportInitiatedEvent extends UserActivityEventBase {
		event: 'Export Initiated';
		format: 'csv' | 'pdf' | 'xlsx';
		entity_type: string;       // e.g. 'customers', 'orders', 'invoices'
		row_count: number;
	}

	// Impersonation UI lifecycle: distinct from the BE-side `Tenant
	// Impersonated` (records the POST that mints the impersonation token) —
	// these bracket the FE-side session.

	interface ImpersonationUiStartedEvent extends UserActivityEventBase {
		event: 'Impersonation UI Started';
		target_store_id: string;
	}

	interface ImpersonationUiEndedEvent extends UserActivityEventBase {
		event: 'Impersonation UI Ended';
		target_store_id: string;
	}

	// Phase 4 (1.6.23) — +11 interaction-coverage variants, FE-emitted via the
	// ingest endpoint; `Action Denied` is ALSO written BE-side on a real 403
	// (the FE emits only its own pre-roundtrip maintenance/subscription/
	// permission denials).
	//
	// PII guarantees: `Search Performed` carries `query_hash` only (raw text
	// never leaves the client); `Two-Factor Recovery Codes Revealed` carries
	// `code_count` only (never the codes); `Action Denied.attempted_action` is
	// a stable verb id; every `*_id` is an opaque entity id — no
	// name/email/CUIT/phone anywhere.

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

	// Search: scope-tagged; query HASHED, never raw (Ley 25.326)
	interface SearchPerformedEvent extends UserActivityEventBase {
		event: 'Search Performed';
		scope: 'customers' | 'audit' | 'suppliers' | 'invoices' | 'payments';
		query_hash?: string; // SHA-256 of the normalized query; omitted when empty/cleared
		result_count?: number; // count only — never the result identities
	}

	// Forensic headline: BE writes the 403 row; FE writes its own pre-roundtrip
	// denials (maintenance/subscription/permission short-circuits).
	interface ActionDeniedEvent extends UserActivityEventBase {
		event: 'Action Denied';
		attempted_action: string; // stable verb id, e.g. 'order.status.advance'
		resource_type: string; // 'order' | 'customer' | 'payment' | 'cash' | …
		resource_id?: string; // present when the gate guards a specific entity
		reason: 'permission' | 'subscription' | 'maintenance';
	}

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

	// Integration token refresh audit

	interface IntegrationTokenRefreshedEvent extends UserActivityEventBase {
		event: 'Integration Token Refreshed';
		// Stripe deliberately excluded — no per-tenant OAuth connect flow /
		// enumeration path exists today.
		provider: 'mercadopago' | 'gmail' | 'mercadolibre';
		outcome: 'refreshed' | 'disconnected' | 'skipped' | 'error';
		trigger: 'operator-single' | 'operator-global';
		detail?: string; // short machine code only — never a token/secret (Ley 25.326)
	}

	// MANAGER converts a pre-launch waitlist registration into a live tenant
	// (`POST /platform/operations { mode: 'convert-waitlist' }`). Target tenant
	// is the base `tenant_store_id`; the MANAGER actor is the base
	// `user_id`/`actor_*` — no variant-specific fields beyond the discriminant.
	interface WaitlistConvertedEvent extends UserActivityEventBase {
		event: 'Waitlist Converted';
	}

	// MANAGER writes a platform-wide setting or feature flag
	// (`POST /platform/globals`). `scope` is the consuming app the key targets
	// (not the actor) — mirrors `LiteralUpdatedEvent.scope`.
	interface PlatformConfigUpdatedEvent extends UserActivityEventBase {
		event: 'Platform Config Updated';
		key: string;
		kind: 'setting' | 'flag';
		// 'web' was retired — the write gate rejects it, so no audit row can carry it.
		scope: 'app' | 'landing' | 'storefront';
		before: string | number | boolean;
		after: string | number | boolean;
	}

	// Marketplace-channel product-link state machine transition
	// (`Product.channels[provider].status`); shared by unlink, which reuses
	// this variant with to_status: 'unlinked'. `provider` is future-proofed
	// even though 'mercadolibre' is the only channel with this state machine today.
	interface MlChannelStatusChangedEvent extends UserActivityEventBase {
		event: 'ML Channel Status Changed';
		provider: 'mercadolibre';
		product_id: string;
		ml_item_id: string;
		from_status: ProductChannelStatus;
		to_status: ProductChannelStatus;
	}

	// PRINT_RULE# useCase routing rules. The addressable target is the
	// (`agent_id`, `printer_id`) PAIR, never `printer_id` alone — it is unique
	// only WITHIN an agent (two machines can both expose "Microsoft Print to PDF").
	interface PrintRuleCreatedEvent extends UserActivityEventBase {
		event: 'Print Rule Created';
		use_case: PrintUseCase;
		agent_id: string;
		printer_id: string;
	}

	// `printer_id` is the NEW target after the edit — re-pointing a use case at
	// a different printer is an update, not a create.
	interface PrintRuleEditedEvent extends UserActivityEventBase {
		event: 'Print Rule Edited';
		use_case: PrintUseCase;
		agent_id: string;
		printer_id: string;
		// Dotted paths for option changes (`options.color`), bare names otherwise.
		// Symmetric diff — a key REMOVED from the options payload is listed too.
		fields_changed: string[];
	}

	// Carries the `printer_id` the rule HAD, captured by the handler's pre-read
	// (the same read that makes a missing rule a 404 rather than a silent 200).
	interface PrintRuleDeletedEvent extends UserActivityEventBase {
		event: 'Print Rule Deleted';
		use_case: PrintUseCase;
		agent_id: string;
		printer_id: string;
	}

	interface PrinterActiveToggledEvent extends UserActivityEventBase {
		event: 'Printer Active Toggled';
		agent_id: string;
		printer_id: string;
		active: boolean;
	}

	// Discriminated union. Count in this comment has drifted before — recount
	// the arms before trusting any number stated here.
	type UserActivityEvent =
		// Phase 1
		| UserLoggedInEvent
		| UserLoggedOutEvent
		| UserPasswordChangedEvent
		| UserSuspendedEvent
		// TOTP 2FA (1.6.18)
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
		| OrderEditedEvent
		| OrderReturnedEvent
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
		// Phase 3 (UI-only — emitted via the ingest endpoint)
		| AuditTrailViewedEvent
		| ReportViewedEvent
		| CustomerPiiViewedEvent
		| CashDrawerUiOpenedEvent
		| CashDrawerUiClosedEvent
		| ExportInitiatedEvent
		| ImpersonationUiStartedEvent
		| ImpersonationUiEndedEvent
		// Phase 4 (interaction coverage)
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
		| TwoFactorResetInitiatedEvent
		// Phase 5
		| IntegrationTokenRefreshedEvent
		| WaitlistConvertedEvent
		// Phase 6
		| PlatformConfigUpdatedEvent
		// Phase 7
		| MlChannelStatusChangedEvent
		// Phase 8 (PRINT_RULE# routing rules)
		| PrintRuleCreatedEvent
		| PrintRuleEditedEvent
		| PrintRuleDeletedEvent
		// Per-printer `active` pause toggle
		| PrinterActiveToggledEvent;

}

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
] as const;

export type UiOnlyUserActivityVariant = (typeof UI_ONLY_USER_ACTIVITY_VARIANTS)[number];

/**
 * Valid per-entity timeline entity types for the user-activity audit feed.
 * MUST stay in sync with the BE `VALID_ENTITY_TYPES` const in
 * `sinfactura/api/stacks/lambdas/userActivity/_get.ts`, which Zod-enums the
 * `entityType` query param.
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
