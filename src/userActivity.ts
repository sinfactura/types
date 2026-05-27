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
// 49 variants:
//   - 1.6.11 (Phase 1, 17 variants) — MVP wire-ins covering the hot paths
//   - 1.6.12 (Phase 2, +32 variants) — full mutating admin-handler coverage

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
		method: 'password' | 'totp' | 'refresh';
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

	interface ProductPriceChangedEvent extends UserActivityEventBase {
		event: 'Product Price Changed';
		product_id: string;
		from_price: number;
		to_price: number;
		currency: string;
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
	// Discriminated union — 49 variants
	// ──────────────────────────────────────────────────────────────────────────

	type UserActivityEvent =
		// Phase 1
		| UserLoggedInEvent
		| UserLoggedOutEvent
		| UserPasswordChangedEvent
		| UserSuspendedEvent
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
		| SupportTicketUpdatedEvent;

}

export {}; // NOSONAR
