
// Typed storefront events pipeline (types#69, api#1239/#1240,
// storefront#425/#429, app#1638). Schema-validated discriminated union
// emitted by `sinfactura/storefront` (via the `track()` wrapper in
// `src/utils/track.ts`), validated and persisted by `sinfactura/api`
// (Zod mirror in `stacks/helpers/storefrontEvents/schema.ts`), rendered
// by `sinfactura/app` (typed activity feed in `<ActivityFeed>`).
//
// Naming follows Segment Spec: Title Case Object + Past-Tense Action
// for event names; snake_case for properties so the GA4 / Segment
// vocabulary on the wire maps without translation.
//
// 14 variants — the 4 storefront-only events (`Page Viewed`,
// `Favorite Toggled`, `Whatsapp Clicked`, `Error Captured`) currently
// emitted by storefront are NOT in this taxonomy yet; they ride the
// legacy `Log` path and are tracked for a follow-up types release.

declare global {

	interface StorefrontEventBase {
		anonymous_id: string;       // localStorage UUID, always present
		customer_id?: string;       // set on authenticated events; mandatory on `Customer Identified`
		tenant_store_id: string;    // e.g. "STO002"
		schema_version: 1;          // literal — bump on breaking change
		event_id: string;           // UUID v4, client-generated (idempotency key)
		screen_type: 'desktop' | 'mobile';
		app_version: number;
		ts: string;                 // ISO 8601
	}

	interface ProductViewedEvent extends StorefrontEventBase {
		event: 'Product Viewed';
		product_id: string;
		product_name: string;
		price: number;
		currency: string;
	}

	interface ProductListViewedEvent extends StorefrontEventBase {
		event: 'Product List Viewed';
		list_name: string;
		products: Array<{ product_id: string; product_name: string; price: number }>;
	}

	interface CartItemAddedEvent extends StorefrontEventBase {
		event: 'Cart Item Added';
		product_id: string;
		product_name: string;
		quantity: number;
		price: number;
		currency: string;
	}

	interface CartItemRemovedEvent extends StorefrontEventBase {
		event: 'Cart Item Removed';
		product_id: string;
		product_name: string;
		quantity: number;
	}

	interface CartViewedEvent extends StorefrontEventBase {
		event: 'Cart Viewed';
		cart_total: number;
		items_count: number;
		currency: string;
	}

	interface SearchSubmittedEvent extends StorefrontEventBase {
		event: 'Search Submitted';
		query: string;
		results_count: number;
	}

	interface CheckoutStartedEvent extends StorefrontEventBase {
		event: 'Checkout Started';
		cart_total: number;
		items_count: number;
		currency: string;
	}

	interface CheckoutStepCompletedEvent extends StorefrontEventBase {
		event: 'Checkout Step Completed';
		step: number;
		step_name: string;
	}

	interface PaymentInfoEnteredEvent extends StorefrontEventBase {
		event: 'Payment Info Entered';
		payment_type: string;
	}

	interface OrderCompletedEvent extends StorefrontEventBase {
		event: 'Order Completed';
		transaction_id: string;
		revenue: number;
		currency: string;
		items_count: number;
	}

	interface CustomerLoggedInEvent extends StorefrontEventBase {
		event: 'Customer Logged In';
		method: 'email' | 'google' | 'facebook';
	}

	interface CustomerSignedUpEvent extends StorefrontEventBase {
		event: 'Customer Signed Up';
		method: 'email' | 'google' | 'facebook';
	}

	interface CustomerLoggedOutEvent extends StorefrontEventBase {
		event: 'Customer Logged Out';
	}

	// `Customer Identified` always carries customer_id (override of the
	// optional base field) — the entire point of this event is to bind
	// anonymous_id → customer_id, so a missing value is a contract violation.
	interface CustomerIdentifiedEvent extends StorefrontEventBase {
		event: 'Customer Identified';
		customer_id: string;
	}

	type StorefrontEvent =
		| ProductViewedEvent
		| ProductListViewedEvent
		| CartItemAddedEvent
		| CartItemRemovedEvent
		| CartViewedEvent
		| SearchSubmittedEvent
		| CheckoutStartedEvent
		| CheckoutStepCompletedEvent
		| PaymentInfoEnteredEvent
		| OrderCompletedEvent
		| CustomerLoggedInEvent
		| CustomerSignedUpEvent
		| CustomerLoggedOutEvent
		| CustomerIdentifiedEvent;

	// Anonymous-to-customer stitch row, written when an anonymous visitor
	// authenticates (api#1240). Partition key on `(tenant_store_id, anonymous_id)`;
	// queried by the customer-activity feed to fan out across linked
	// anonymous partitions, with `since: linked_at` so pre-stitch events
	// on a shared device don't leak across customers (Ley 25.326).
	interface IdentityLink {
		tenant_store_id: string;
		anonymous_id: string;
		customer_id: string;
		linked_at: string;       // ISO 8601
		link_event_id: string;   // event_id of the `Customer Identified` event that stitched the pair
	}

}

export {}; // NOSONAR
