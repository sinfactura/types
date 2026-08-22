declare global {
    interface StorefrontEventBase {
        anonymous_id: string;
        customer_id?: string;
        tenant_store_id: string;
        schema_version: 1;
        event_id: string;
        screen_type: 'desktop' | 'mobile';
        app_version: number;
        ts: string;
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
        products: Array<{
            product_id: string;
            product_name: string;
            price: number;
        }>;
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
        method: 'email' | 'google' | 'facebook';
    }
    interface CustomerSignedUpEvent extends StorefrontEventBase {
        event: 'Customer Signed Up';
        method: 'email' | 'google' | 'facebook';
    }
    interface CustomerLoggedOutEvent extends StorefrontEventBase {
        event: 'Customer Logged Out';
    }
    interface CustomerIdentifiedEvent extends StorefrontEventBase {
        event: 'Customer Identified';
        customer_id: string;
    }
    interface CustomerPasswordResetRequestedEvent extends StorefrontEventBase {
        event: 'Customer Password Reset Requested';
        email: string;
        customer_found: boolean;
    }
    type StorefrontEvent = ProductViewedEvent | ProductListViewedEvent | CartItemAddedEvent | CartItemRemovedEvent | CartViewedEvent | SearchSubmittedEvent | CheckoutStartedEvent | CheckoutStepCompletedEvent | PaymentInfoEnteredEvent | OrderCompletedEvent | OrderCancelledByCustomerEvent | CustomerLoggedInEvent | CustomerSignedUpEvent | CustomerLoggedOutEvent | CustomerIdentifiedEvent | CustomerPasswordResetRequestedEvent;
    interface IdentityLink {
        tenant_store_id: string;
        anonymous_id: string;
        customer_id: string;
        linked_at: string;
        link_event_id: string;
    }
}
export {};
