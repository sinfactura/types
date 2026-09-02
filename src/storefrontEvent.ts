
// Typed storefront events pipeline. Schema-validated discriminated union
// emitted by `sinfactura/storefront` (via the `track()` wrapper in
// `src/utils/track.ts`), validated and persisted by `sinfactura/api`
// (Zod mirror in `stacks/helpers/storefrontEvents/schema.ts`), rendered
// by `sinfactura/app` (typed activity feed in `<ActivityFeed>`).
//
// Naming follows Segment Spec: Title Case Object + Past-Tense Action
// for event names; snake_case for properties so the GA4 / Segment
// vocabulary on the wire maps without translation.
//
// 21 variants — the 4 storefront-only events (`Page Viewed`,
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

	/**
	 * Customer self-cancelled their own order from the storefront.
	 *
	 * Always carries `customer_id` — self-cancellation requires an authenticated
	 * customerToken, so an anonymous variant is a contract violation. This is the
	 * customer-facing counterpart to the operator's `Order Cancelled`
	 * UserActivity event; the two are separate audit surfaces.
	 */
	interface OrderCancelledByCustomerEvent extends StorefrontEventBase {
		event: 'Order Cancelled By Customer';
		customer_id: string;
		transaction_id: string;
		/** Revenue reversed by the cancellation, in the order's own currency. */
		revenue: number;
		currency: string;
		/** Optional bounded free text the customer supplied. */
		reason?: string;
		/** ms elapsed between order creation and cancellation — feeds window tuning. */
		elapsed_ms: number;
	}

	interface CustomerLoggedInEvent extends StorefrontEventBase {
		event: 'Customer Logged In';
		/**
		 * ⚠️ `'email'` here is what `CustomerSignInProvider` spells
		 * `'password'`; the other members share their spelling. Neither value is
		 * assignable to the other's slot — map across explicitly.
		 */
		method: 'email' | 'google' | 'facebook' | 'apple';
	}

	interface CustomerSignedUpEvent extends StorefrontEventBase {
		event: 'Customer Signed Up';
		/**
		 * Same union as the sign-in twin, and deliberately so: one shared
		 * validator covers both events server-side, so they cannot diverge
		 * without splitting it.
		 *
		 * ⚠️ Only `'email'` is emitted today — registration is api-side and has
		 * no social leg. The social members are reachable shape, not observed
		 * data; do not read a member's presence here as evidence that path
		 * exists.
		 */
		method: 'email' | 'google' | 'facebook' | 'apple';
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

	// Customer requested a password-reset email. Fires from the BE-side
	// `web/lambdas/auth/recover.ts` (not from the FE's `track()` path) —
	// the reset flow runs before any WS connects, so this is BE-emitted.
	// `customer_found: false` rows are valuable for credential-stuffing /
	// email-enumeration detection; the handler still returns the generic
	// "if an account exists…" message to the customer, so this never leaks
	// existence back to the requester.
	interface CustomerPasswordResetRequestedEvent extends StorefrontEventBase {
		event: 'Customer Password Reset Requested';
		email: string;
		customer_found: boolean;
	}

	// The five events below are BE-emitted from authenticated Web API routes
	// via `recordStorefrontEvent`, not from the FE's `track()` path. Every one
	// of them redeclares `customer_id` as required (override of the optional
	// base field): the route behind each demands a customerToken, so a row
	// without a customer is a contract violation, not a sparse record.
	//
	// Their property sets are deliberately narrow — identifiers and counts
	// only, never field VALUES and never free text. This stream is retained
	// for analytics and read back by the operator activity feed, so anything
	// customer-authored in it would be PII under Ley 25.326.

	// Customer opened/acknowledged a single notification.
	interface NotificationMarkedReadEvent extends StorefrontEventBase {
		event: 'Notification Marked Read';
		customer_id: string;
		notification_id: string;
	}

	// Customer cleared their whole notification tray in one action.
	interface NotificationsMarkedAllReadEvent extends StorefrontEventBase {
		event: 'Notifications Marked All Read';
		customer_id: string;
		/** How many notifications the bulk action actually flipped to read. */
		count: number;
	}

	// Post-order satisfaction survey returned by the customer.
	interface SurveySubmittedEvent extends StorefrontEventBase {
		event: 'Survey Submitted';
		customer_id: string;
		order_id: string;
		/**
		 * 1–4 inclusive. The range is enforced by the api's Zod mirror, not by
		 * the type — a branded type here would only move the check somewhere it
		 * cannot run, since this union is compile-time only.
		 */
		rating: number;
		// ⚠️ No `comment` field, deliberately. The survey's free-text comment is
		// customer-authored PII and must never enter this stream; it stays on
		// the survey entity itself. Do not add one.
	}

	// Customer edited their own profile.
	interface CustomerProfileUpdatedEvent extends StorefrontEventBase {
		event: 'Customer Profile Updated';
		customer_id: string;
		/**
		 * The NAMES of the fields that changed (e.g. `['phone', 'address']`) —
		 * never their values. The old and new values are PII; only the shape of
		 * the edit belongs here.
		 */
		fields: string[];
	}

	// Customer changed their own password from an authenticated session.
	// Carries nothing but the actor: this is a security-audit marker, and any
	// further property would either be a secret or a value nobody needs.
	interface CustomerPasswordChangedEvent extends StorefrontEventBase {
		event: 'Customer Password Changed';
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
		| OrderCancelledByCustomerEvent
		| CustomerLoggedInEvent
		| CustomerSignedUpEvent
		| CustomerLoggedOutEvent
		| CustomerIdentifiedEvent
		| CustomerPasswordResetRequestedEvent
		| NotificationMarkedReadEvent
		| NotificationsMarkedAllReadEvent
		| SurveySubmittedEvent
		| CustomerProfileUpdatedEvent
		| CustomerPasswordChangedEvent;

	// Anonymous-to-customer stitch row, written when an anonymous visitor
	// authenticates. Partition key on `(tenant_store_id, anonymous_id)`;
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
