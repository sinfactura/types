declare global {
    interface UserActivityEventBase {
        tenant_store_id: string;
        user_id: string;
        actor_role: 'USER' | 'ADMIN' | 'SUPERVISOR' | 'MANAGER';
        actor_full_name: string;
        actor_ip?: string;
        event_id: string;
        schema_version: 1;
        ts: string;
    }
    interface UserLoggedInEvent extends UserActivityEventBase {
        event: 'User Logged In';
        method: 'password' | 'totp' | 'refresh';
    }
    interface UserLoggedOutEvent extends UserActivityEventBase {
        event: 'User Logged Out';
    }
    interface UserPasswordChangedEvent extends UserActivityEventBase {
        event: 'User Password Changed';
        target_user_id: string;
    }
    interface UserSuspendedEvent extends UserActivityEventBase {
        event: 'User Suspended';
        target_user_id: string;
        reason: string;
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
    interface ProductPriceChangedEvent extends UserActivityEventBase {
        event: 'Product Price Changed';
        product_id: string;
        from_price: number;
        to_price: number;
        currency: string;
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
    interface LiteralUpdatedEvent extends UserActivityEventBase {
        event: 'Literal Updated';
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
        fields_revealed: string[];
    }
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
        entity_type: string;
        row_count: number;
    }
    interface ImpersonationUiStartedEvent extends UserActivityEventBase {
        event: 'Impersonation UI Started';
        target_store_id: string;
    }
    interface ImpersonationUiEndedEvent extends UserActivityEventBase {
        event: 'Impersonation UI Ended';
        target_store_id: string;
    }
    type UserActivityEvent = UserLoggedInEvent | UserLoggedOutEvent | UserPasswordChangedEvent | UserSuspendedEvent | StorePaletteChangedEvent | StoreSettingsUpdatedEvent | PlanChangedEvent | InvoiceCreatedEvent | OrderCreatedEvent | OrderCancelledEvent | ProductPriceChangedEvent | CustomerCreatedEvent | CustomerEditedEvent | CashDrawerOpenedEvent | CashDrawerClosedEvent | TenantImpersonatedEvent | SecretRotatedEvent | UserCreatedEvent | UserUpdatedEvent | ProductCreatedEvent | ProductUpdatedEvent | StockIncomeCreatedEvent | CategoryCreatedEvent | CategoryUpdatedEvent | BrandCreatedEvent | BrandUpdatedEvent | SupplierCreatedEvent | SupplierUpdatedEvent | SupplierInvoiceCreatedEvent | SupplierAccountCreatedEvent | SupplierAccountUpdatedEvent | AccountCreatedEvent | AccountDeletedEvent | BasketUpdatedEvent | BasketDeletedEvent | CashDrawerMovementEvent | PaymentCreatedEvent | PaymentLinkedEvent | PaymentUnlinkedEvent | PaymentLinkageUpdatedEvent | NotificationReadEvent | LogDeletedEvent | PlanCreatedEvent | StoreMaintenanceToggledEvent | PlatformMaintenanceToggledEvent | TenantCreatedEvent | LiteralUpdatedEvent | SupportTicketCreatedEvent | SupportTicketUpdatedEvent | AuditTrailViewedEvent | ReportViewedEvent | CustomerPiiViewedEvent | CashDrawerUiOpenedEvent | CashDrawerUiClosedEvent | ExportInitiatedEvent | ImpersonationUiStartedEvent | ImpersonationUiEndedEvent;
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
export declare const UI_ONLY_USER_ACTIVITY_VARIANTS: readonly ["Audit Trail Viewed", "Report Viewed", "Customer PII Viewed", "Cash Drawer UI Opened", "Cash Drawer UI Closed", "Export Initiated", "Impersonation UI Started", "Impersonation UI Ended"];
export type UiOnlyUserActivityVariant = (typeof UI_ONLY_USER_ACTIVITY_VARIANTS)[number];
