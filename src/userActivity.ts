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
// 17 variants — covers the Phase 1 MVP wire-ins in api#1244 plus the rest of
// the canonical taxonomy. Add new variants here as Phase 2/3 ships coverage.

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

	// Business operations (5)

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

	type UserActivityEvent =
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
		| SecretRotatedEvent;

}

export {}; // NOSONAR
