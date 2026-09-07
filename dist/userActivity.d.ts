declare global {
    /**
     * Everything an activity row carries regardless of WHO acted. Split out so
     * the staff and customer actor vocabularies cannot drift: there is one list
     * of common fields, and each base below adds only its own `actor_role`.
     *
     * ⚠️ `actor_ip` is PII under Ley 25.326 — never render it to a party other
     * than the data subject, and keep it out of every log surface.
     */
    interface ActivityEventBase {
        tenant_store_id: string;
        user_id: string;
        actor_full_name: string;
        actor_ip?: string;
        event_id: string;
        schema_version: 1;
        ts: string;
    }
    /**
     * A row written for a STAFF action. Structurally identical to what this
     * interface has always been — the split above adds no field and removes
     * none, so no existing consumer sees a change.
     *
     * ⚠️ `actor_role` is a STAFF vocabulary and `'CUSTOMER'` is deliberately NOT
     * a member. A customer is not a staff role, and widening this union would
     * force every exhaustive switch over it to handle a case that cannot occur
     * for these events. Customer-initiated rows use
     * {@link CustomerActivityEventBase} instead.
     */
    interface UserActivityEventBase extends ActivityEventBase {
        actor_role: 'USER' | 'ADMIN' | 'SUPERVISOR' | 'MANAGER' | 'PRINTER';
    }
    /**
     * A row written for an action the CUSTOMER took themselves, landing in the
     * same append-only store. `user_id` is the customer's own id.
     *
     * ⚠️ Not `StorefrontEvent`. That stream is client-emitted telemetry rendered
     * in a customer-visible feed, and its own contract forbids carrying changed
     * VALUES — only field names. A consent record has to be server-attested and
     * has to carry the values, which is the whole point of an evidentiary trail.
     */
    interface CustomerActivityEventBase extends ActivityEventBase {
        actor_role: 'CUSTOMER';
    }
    /**
     * One channel's consent transition where a GRANT is possible.
     *
     * ⚠️ Distinct from {@link CustomerConsentChange}, whose `to: false` literal
     * is the compile-time guarantee that a STAFF edit can only ever clear
     * consent, never grant it. Do not merge the two — widening that literal to
     * `boolean` would delete the guarantee, and no comment replaces a type.
     */
    interface CustomerConsentGrantChange {
        channel: 'adds' | 'email' | 'phone' | 'sms' | 'whatsapp';
        from: boolean | null;
        to: boolean;
        source: 'ui' | 'import' | 'api' | 'storefront';
        /** ⚠️ PII — absent when the write had no request-level IP. */
        ip?: string;
    }
    /** A customer changed their own marketing consent through a self-service surface. */
    interface CustomerConsentUpdatedEvent extends CustomerActivityEventBase {
        event: 'Customer Consent Updated';
        customer_id: string;
        consent_changes: CustomerConsentGrantChange[];
    }
    /** A staff CSV import set consent on a customer row, on the customer's word. */
    interface CustomerConsentImportedEvent extends UserActivityEventBase {
        event: 'Customer Consent Imported';
        customer_id: string;
        consent_changes: CustomerConsentGrantChange[];
    }
    /**
     * ONE row per staff CSV import round that changed consent on at least one
     * customer — the rolled-up form of {@link CustomerConsentImportedEvent}, which
     * a max-size import would otherwise emit ~10k times into a handler already
     * near its timeout.
     *
     * The per-row evidence lives on the customer rows themselves: the import
     * bakes `marketing.consent.<channel> = { ts, source: 'import' }` into the same
     * PutRequest that persists the row, so it cannot diverge from row persistence.
     * This event carries the pointer to those rows, not a copy of them: an
     * import mints one CONTIGUOUS block of customer ids, so
     * `first_customer_id..last_customer_id` bounds a `SK BETWEEN` query on
     * `CUSTOMER#{storeId}`, filtered on `marketing.consent.<channel>.source ===
     * 'import'`.
     *
     * `status` is `'partial'` on ANY round failure or unprocessed item across the
     * whole import — conservative on purpose, so a partial import is
     * distinguishable from a complete one from this row alone.
     */
    interface CustomerConsentImportCompletedEvent extends UserActivityEventBase {
        event: 'Customer Consent Import Completed';
        status: 'complete' | 'partial';
        /** Rows where a channel changed AND the row was confirmed persisted. */
        rows_touched: number;
        first_customer_id: string;
        last_customer_id: string;
    }
    /** Rows written for a customer's own action. Kept separate from {@link UserActivityEvent}. */
    type CustomerActivityEvent = CustomerConsentUpdatedEvent;
    interface UserLoggedInEvent extends UserActivityEventBase {
        event: 'User Logged In';
        /**
         * How the session was established. `'magic-link'` is a PASSWORDLESS
         * primary login — never fold it into `'password'`, which would put a
         * false method in the audit trail. The 2FA branch still resolves to
         * `'totp'`/`'recovery'` as it does for every other primary method.
         */
        method: 'password' | 'totp' | 'refresh' | 'social' | 'recovery' | 'magic-link';
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
    interface TwoFactorEnrolledEvent extends UserActivityEventBase {
        event: 'Two-Factor Enrolled';
    }
    interface TwoFactorDisabledEvent extends UserActivityEventBase {
        event: 'Two-Factor Disabled';
    }
    interface TwoFactorResetEvent extends UserActivityEventBase {
        event: 'Two-Factor Reset';
        target_user_id: string;
    }
    interface TwoFactorRecoveryCodesGeneratedEvent extends UserActivityEventBase {
        event: 'Two-Factor Recovery Codes Generated';
        count: number;
        trigger: 'enrollment' | 'regenerate';
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
        changes?: PriceListChange[];
    }
    interface CustomerCreatedEvent extends UserActivityEventBase {
        event: 'Customer Created';
        customer_id: string;
    }
    /**
     * One staff-side change to a single `Customer.marketing` channel.
     *
     * ⚠️ `to` is the literal `false`, not `boolean`, and that is load-bearing.
     * Staff may CLEAR a consent flag and may never grant one — a customer's
     * consent can only ever come from the customer. Typing the literal makes
     * the compiler refuse an emission that records a grant, so the rule is
     * enforced at every call site rather than restated in a comment. Widening
     * this to `boolean` would be a deliberate change to that policy, which is
     * exactly the kind of decision that should cost a types publish.
     *
     * `from` is `null` when the channel had never been set, which is a
     * different fact from `false` (explicitly opted out before) and must stay
     * distinguishable in an audit record.
     */
    interface CustomerConsentChange {
        channel: 'adds' | 'email' | 'phone' | 'sms' | 'whatsapp';
        from: boolean | null;
        to: false;
    }
    interface CustomerEditedEvent extends UserActivityEventBase {
        event: 'Customer Edited';
        customer_id: string;
        fields_changed: string[];
        /**
         * Present only when a staff-side write touched `Customer.marketing`.
         * Absent — not an empty array — when the edit left consent alone, so
         * "no consent change" and "consent examined and unchanged" do not have
         * to be told apart by a reader.
         *
         * `who` and `when` are already carried by `UserActivityEventBase`
         * (`actor_full_name`, `actor_role`, `ts`); this adds only the per-
         * channel before/after the base cannot express.
         */
        consent_changes?: CustomerConsentChange[];
    }
    /**
     * The server released a customer's stored record to a caller.
     *
     * ⚠️ This records a SERVER RELEASE, not a user navigation, and the two are
     * not the same audit fact. The app emits its own `Customer Detail Viewed`
     * when someone opens a detail screen; this fires whenever the route hands
     * the row over, so it stays true when the caller is a script with a valid
     * token and there is no view at all. Treating either as a substitute for
     * the other leaves exactly the accesses an audit exists to catch —
     * automated ones — unrecorded.
     *
     * ⚠️ It deliberately carries the id SERVED and never what was ASKED. The
     * route accepts `?email=` and `?search=`, so echoing the query would write
     * customer email addresses and operator search terms into the audit trail,
     * trading an attribution gap for a PII leak. `customer_id` answers "whose
     * record left the building", which is the question this event exists for.
     */
    interface CustomerRecordServedEvent extends UserActivityEventBase {
        event: 'Customer Record Served';
        customer_id: string;
        /**
         * Which shape was released. Once the commercial fields are role-gated
         * the same route serves two different records, and a row that cannot
         * say which one it served is only half an audit entry — `display`
         * (identity and contact) is an ordinary lookup, while `full`
         * (including the commercial figures) is the access worth reviewing.
         */
        field_set: 'full' | 'display';
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
        /** Why the shift was force-closed. Present only when the closer was not the owner. */
        reason?: string;
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
    /**
     * A manual, audited stock adjustment: shrinkage, breakage, a physical count
     * correction, or stock found after being written off. Distinct from
     * `Stock Income Created`, which records a PURCHASE — an adjustment buys
     * nothing and sells nothing, it reconciles the books to reality.
     *
     * BE-emitted from the mutating handler, exactly like `Stock Income Created`.
     * Never add it to `UI_ONLY_USER_ACTIVITY_VARIANTS`: the FE must not be able
     * to POST a stock adjustment into the audit trail without one having
     * happened.
     */
    interface StockAdjustedEvent extends UserActivityEventBase {
        event: 'Stock Adjusted';
        product_id: string;
        /**
         * SIGNED change applied to on-hand: negative for shrinkage/breakage/a
         * count that came out short, positive for found stock/a count that came
         * out long. Signed here even though the underlying ledger row always
         * carries a positive `quantity` — the ledger encodes direction in which
         * partition the row lands in, and an audit reader has no partition to
         * look at.
         */
        quantity_delta: number;
        reason: StockAdjustmentReason;
        /**
         * The operator's free-text justification, if given. Mirrors
         * `adjustmentNote` on the ledger row and carries the same prohibition:
         * no personal data, ever. This feed is append-only and anti-erasure.
         */
        note?: string;
        /**
         * Groups every adjustment emitted by one physical stock-count session's
         * finalise step, mirroring `stocktakeId` on the ledger rows. Absent when
         * the operator adjusted a single product directly.
         */
        stocktake_id?: string;
        /**
         * The physical count the operator actually entered, which is the EVIDENCE
         * an adjustment is defended with — `quantity_delta` alone says what
         * changed but not what was observed. Present only alongside
         * `stocktake_id`; absent for a direct adjustment, where nothing was
         * counted.
         *
         * It lives on the audit event and NOT on the ledger row on purpose: the
         * row records a movement, this records the act that justified it, and
         * this feed is the one with multi-year retention and anti-erasure.
         */
        counted_quantity?: number;
        /** Unit cost the adjustment is valued at — the product's cost at write time. */
        cost: number;
        currency: string;
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
        /**
         * ⚠️ OPTIONAL because a walk-in POS ticket has no customer at all.
         *
         * The audit must still fire for one: an operator touching an anonymous
         * counter ticket is MORE worth auditing than one touching a named
         * customer's cart, so dropping the record would put the least
         * attributable writes in the store outside the audit trail entirely.
         *
         * ⚠️ Never substitute the cart id here to satisfy a required field. A
         * field that reads as one kind of id and holds another is undetectable
         * downstream — exactly the defect that had cart socket frames carrying
         * a cart id under `customerId`.
         */
        customer_id?: string;
        items_count: number;
        total: number;
    }
    /**
     * A DISCOUNT was granted or withdrawn on a cart — a per-line cut, or a coupon
     * applied or removed.
     *
     * ⚠️ **Distinct from `BasketUpdatedEvent` on purpose.** That event carries
     * `{ items_count, total }`, which makes a 90% cut indistinguishable from a
     * price change in the trail. It already answers WHO (`user_id`,
     * `actor_role`, `actor_full_name`, `actor_ip` ride on the base); what it
     * cannot answer is WHAT and BY HOW MUCH, and those are the two questions a
     * discount-abuse review is made of.
     *
     * ⚠️ Together with `Order.coupons` this is what makes **employee
     * self-redemption detectable**. Neither is sufficient alone: the order record
     * says a redemption happened, this says who granted it. A per-user `discount`
     * permission decides who *may*; only this says who *did*.
     */
    interface BasketDiscountGrantedEvent extends UserActivityEventBase {
        event: 'Basket Discount Granted';
        /** Which verb — a withdrawal is as worth auditing as a grant. */
        verb: 'setLineDiscount' | 'applyCoupon' | 'removeCoupon';
        /**
         * The grant's unit. Absent on `removeCoupon`, which withdraws rather than
         * grants and therefore has no terms of its own.
         */
        type?: 'percent' | 'amount';
        /** The GRANT, in the unit `type` names — NOT money. See `amount`. */
        value?: number;
        /**
         * The MONEY the grant actually took, in the cart's currency, after every
         * clamp.
         *
         * ⚠️ Recorded ALONGSIDE `value` rather than instead of it, because the two
         * answer different review questions and neither implies the other: `value`
         * is what the operator chose, `amount` is what it cost. A 15% grant on a
         * large ticket and a 15% grant on a small one are the same decision and
         * wildly different money.
         */
        amount?: number;
        /** The coupon code, on the two coupon verbs. Absent for a line discount. */
        code?: string;
        /** The line the cut was applied to, on `setLineDiscount`. */
        line_id?: string;
        /** ⚠️ Optional for the same reason as `BasketUpdatedEvent.customer_id`: a
         *  walk-in POS ticket has no customer, and an operator discounting an
         *  anonymous counter ticket is MORE worth auditing, not less. */
        customer_id?: string;
    }
    interface BasketDeletedEvent extends UserActivityEventBase {
        event: 'Basket Deleted';
        /** Optional for the same reason as `BasketUpdatedEvent.customer_id`:
         *  deleting a walk-in ticket is the same event with no customer. */
        customer_id?: string;
    }
    interface CashDrawerMovementEvent extends UserActivityEventBase {
        event: 'Cash Drawer Movement';
        cash_id: string;
        direction: 'income' | 'outcome';
        amount: number;
        currency: string;
        concept: string;
    }
    interface ClockedInEvent extends UserActivityEventBase {
        event: 'Clocked In';
        shift_id: string;
        source: ClockEventSource;
        geohash?: string;
    }
    interface ClockedOutEvent extends UserActivityEventBase {
        event: 'Clocked Out';
        shift_id: string;
        total_minutes: number;
        overtime_minutes?: number;
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
    /**
     * A cashier proceeded with an account (cuenta corriente) sale that breached the
     * customer's `creditLimit`.
     *
     * The limit WARNS rather than blocks, and the recording is the thing traded for
     * the block: a hard refusal produces no record at all, and the merchant's
     * workaround for one is to edit the limit mid-sale, which makes the limit noise.
     * So this event is not an optional audit nicety — it is the half of the feature
     * that a block cannot deliver, and an override written without it is a dismissed
     * toast.
     *
     * ⚠️ Only the `reason` travels from the client. `user_id`, `actor_full_name` and
     * `ts` on the base carry the who and the when, stamped server-side from the
     * token — a client does not get to attribute its own override.
     *
     * Emitted only when the sale actually proceeded past a breach. A sale inside the
     * limit emits nothing, and a caller lacking the `payments` capability cannot
     * reach this at all.
     */
    interface CreditLimitOverriddenEvent extends UserActivityEventBase {
        event: 'Credit Limit Overridden';
        customer_id: string;
        /** Absent when the override was recorded before the order id existed. */
        order_id?: string;
        /**
         * The account leg this sale put on the customer's tab, in the store's display
         * currency. Required, and knowable without reading the customer at all — it is
         * the order's own `source: 'account'` tender leg.
         */
        attempted_amount: number;
        /**
         * ⚠️ The three balance-derived figures below are OPTIONAL, and their absence is
         * a real state rather than missing data: they are populated only once
         * `Customer.balance` is trustworthy.
         *
         * Until the `ACCOUNT#` ledger becomes authoritative and the scalar a derived
         * cache, `Customer.balance` is mutated in place by eight writers with nothing
         * reconciling it. Stamping a number that can be wrong into an APPEND-ONLY audit
         * trail is worse than stamping none — a record nobody can trust is still a
         * record somebody will later rely on, and unlike a live read it can never be
         * corrected by re-reading.
         *
         * So an event written today carries `attempted_amount` and `reason` and omits
         * these; one written afterwards carries all four. A reader must treat absence
         * as "not knowable when this was written", never as zero.
         */
        credit_limit?: number;
        /** `Customer.balance` as the server read it, BEFORE this sale. */
        balance_before?: number;
        /** `balance_before + attempted_amount` — what the customer is left owing. */
        exposure?: number;
        /** The cashier's justification. Free text, client-supplied, never inferred. */
        reason: string;
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
        return_to?: string;
    }
    interface ImpersonationUiEndedEvent extends UserActivityEventBase {
        event: 'Impersonation UI Ended';
        target_store_id: string;
    }
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
    interface SearchPerformedEvent extends UserActivityEventBase {
        event: 'Search Performed';
        scope: 'customers' | 'audit' | 'suppliers' | 'invoices' | 'payments';
        query_hash?: string;
        result_count?: number;
    }
    interface ActionDeniedEvent extends UserActivityEventBase {
        event: 'Action Denied';
        attempted_action: string;
        resource_type: string;
        resource_id?: string;
        reason: 'permission' | 'subscription' | 'maintenance';
    }
    interface TwoFactorChallengeShownEvent extends UserActivityEventBase {
        event: 'Two-Factor Challenge Shown';
        /**
         * The PRIMARY login the step-up interrupted, never the second factor
         * itself — that is `TwoFactorCodeValidationFailedEvent.method`.
         *
         * ⚠️ `'magic-link'` is a PASSWORDLESS primary login and must never be
         * folded into `'password'`, for the same reason `UserLoggedInEvent`
         * states it: a magic-link challenge recorded as a password challenge
         * puts a false method in the audit trail. It is a member here because
         * `_magicLinkVerify` runs the same `enforceTotpStepUp` helper password
         * and social login run, so the interstitial is reached from a third
         * entry point; before it existed the emit was suppressed on that path
         * rather than falsified, which under-reported challenge counts.
         */
        method: 'password' | 'social' | 'magic-link';
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
        code_count: number;
    }
    interface TwoFactorResetInitiatedEvent extends UserActivityEventBase {
        event: 'Two-Factor Reset Initiated';
        target_user_id: string;
        initiator_role: string;
    }
    interface IntegrationTokenRefreshedEvent extends UserActivityEventBase {
        event: 'Integration Token Refreshed';
        provider: 'mercadopago' | 'gmail' | 'mercadolibre';
        outcome: 'refreshed' | 'disconnected' | 'skipped' | 'error';
        trigger: 'operator-single' | 'operator-global';
        detail?: string;
    }
    interface WaitlistConvertedEvent extends UserActivityEventBase {
        event: 'Waitlist Converted';
    }
    interface PlatformConfigUpdatedEvent extends UserActivityEventBase {
        event: 'Platform Config Updated';
        key: string;
        kind: 'setting' | 'flag';
        scope: 'app' | 'landing' | 'storefront';
        before: string | number | boolean;
        after: string | number | boolean;
    }
    interface MlChannelStatusChangedEvent extends UserActivityEventBase {
        event: 'ML Channel Status Changed';
        provider: 'mercadolibre';
        product_id: string;
        ml_item_id: string;
        from_status: ProductChannelStatus;
        to_status: ProductChannelStatus;
    }
    interface PrintRuleCreatedEvent extends UserActivityEventBase {
        event: 'Print Rule Created';
        use_case: PrintUseCase;
        agent_id: string;
        printer_id: string;
    }
    interface PrintRuleEditedEvent extends UserActivityEventBase {
        event: 'Print Rule Edited';
        use_case: PrintUseCase;
        agent_id: string;
        printer_id: string;
        fields_changed: string[];
    }
    interface PrintRuleDeletedEvent extends UserActivityEventBase {
        event: 'Print Rule Deleted';
        use_case: PrintUseCase;
        agent_id: string;
        printer_id: string;
    }
    interface WebhookCreatedEvent extends UserActivityEventBase {
        event: 'Webhook Created';
        webhook_id: string;
        url: string;
        events: import('./webhook').WebhookEventType[];
    }
    interface WebhookUpdatedEvent extends UserActivityEventBase {
        event: 'Webhook Updated';
        webhook_id: string;
        fields_changed: string[];
    }
    interface WebhookDeletedEvent extends UserActivityEventBase {
        event: 'Webhook Deleted';
        webhook_id: string;
        url: string;
    }
    interface PrinterActiveToggledEvent extends UserActivityEventBase {
        event: 'Printer Active Toggled';
        agent_id: string;
        printer_id: string;
        active: boolean;
    }
    interface PrinterRawFormatsUpdatedEvent extends UserActivityEventBase {
        event: 'Printer Raw Formats Updated';
        agent_id: string;
        printer_id: string;
        raw_formats: ('zpl' | 'escpos')[];
    }
    /**
     * A MANAGER edit to a PLAN TEMPLATE's own fields via
     * `PATCH /platform/billing/plans/{tier}` — the catalog row, not anybody's
     * subscription.
     *
     * ⚠️ Deliberately NOT `Plan Changed`, which models a TENANT moving between
     * subscription tiers. Reusing that variant here would make a catalog edit
     * indistinguishable from a customer upgrade in the audit feed, and the two
     * have different actors, different blast radius and different retention
     * interest. `before`/`after` follow `StoreSettingsUpdatedEvent`'s shape.
     */
    interface PlanTemplateUpdatedEvent extends UserActivityEventBase {
        event: 'Plan Template Updated';
        tier: string;
        before: Record<string, unknown>;
        after: Record<string, unknown>;
    }
    interface SupplierAccountDeletedEvent extends UserActivityEventBase {
        event: 'Supplier Account Deleted';
        supplier_id: string;
        account_id: string;
    }
    interface CustomerPasswordResetInitiatedEvent extends UserActivityEventBase {
        event: 'Customer Password Reset Initiated';
        customer_id: string;
        email_sent: boolean;
    }
    interface UserSessionsRevokedEvent extends UserActivityEventBase {
        event: 'User Sessions Revoked';
        target_user_id: string;
        revoked_count: number;
    }
    interface UserPasswordResetInitiatedByOperatorEvent extends UserActivityEventBase {
        event: 'User Password Reset Initiated by Operator';
        target_user_id: string;
        email_sent: boolean;
    }
    interface AgentCommandDispatchedEvent extends UserActivityEventBase {
        event: 'Agent Command Dispatched';
        agent_id: string;
        command: import('./socket').AgentCommand;
        command_id: string;
        destructive: boolean;
    }
    type UserActivityEvent = CustomerConsentImportedEvent | CustomerConsentImportCompletedEvent | UserLoggedInEvent | UserLoggedOutEvent | UserPasswordChangedEvent | UserSuspendedEvent | TwoFactorEnrolledEvent | TwoFactorDisabledEvent | TwoFactorResetEvent | TwoFactorRecoveryCodesGeneratedEvent | StoreSettingsUpdatedEvent | PlanChangedEvent | InvoiceCreatedEvent | OrderCreatedEvent | OrderCancelledEvent | OrderEditedEvent | OrderReturnedEvent | ProductPriceChangedEvent | CustomerCreatedEvent | CustomerEditedEvent | CustomerRecordServedEvent | CashDrawerOpenedEvent | CashDrawerClosedEvent | TenantImpersonatedEvent | SecretRotatedEvent | UserCreatedEvent | UserUpdatedEvent | ProductCreatedEvent | ProductUpdatedEvent | StockIncomeCreatedEvent | StockAdjustedEvent | CategoryCreatedEvent | CategoryUpdatedEvent | BrandCreatedEvent | BrandUpdatedEvent | SupplierCreatedEvent | SupplierUpdatedEvent | SupplierInvoiceCreatedEvent | SupplierAccountCreatedEvent | SupplierAccountUpdatedEvent | AccountCreatedEvent | AccountDeletedEvent | BasketUpdatedEvent | BasketDiscountGrantedEvent | BasketDeletedEvent | CashDrawerMovementEvent | PaymentCreatedEvent | PaymentLinkedEvent | PaymentUnlinkedEvent | PaymentLinkageUpdatedEvent | CreditLimitOverriddenEvent | NotificationReadEvent | LogDeletedEvent | PlanCreatedEvent | StoreMaintenanceToggledEvent | PlatformMaintenanceToggledEvent | TenantCreatedEvent | LiteralUpdatedEvent | SupportTicketCreatedEvent | SupportTicketUpdatedEvent | AuditTrailViewedEvent | ReportViewedEvent | CustomerPiiViewedEvent | CashDrawerUiOpenedEvent | CashDrawerUiClosedEvent | ExportInitiatedEvent | ImpersonationUiStartedEvent | ImpersonationUiEndedEvent | PaymentViewedEvent | InvoiceViewedEvent | CustomerDetailViewedEvent | SupplierAccountViewedEvent | SearchPerformedEvent | ActionDeniedEvent | TwoFactorChallengeShownEvent | TwoFactorCodeValidationFailedEvent | TwoFactorEnrollmentStartedEvent | TwoFactorRecoveryCodesRevealedEvent | TwoFactorResetInitiatedEvent | IntegrationTokenRefreshedEvent | WaitlistConvertedEvent | PlatformConfigUpdatedEvent | MlChannelStatusChangedEvent | PrintRuleCreatedEvent | PrintRuleEditedEvent | PrintRuleDeletedEvent | WebhookCreatedEvent | WebhookUpdatedEvent | WebhookDeletedEvent | PrinterActiveToggledEvent | PrinterRawFormatsUpdatedEvent | PlanTemplateUpdatedEvent | SupplierAccountDeletedEvent | CustomerPasswordResetInitiatedEvent | UserSessionsRevokedEvent | UserPasswordResetInitiatedByOperatorEvent | AgentCommandDispatchedEvent | ClockedInEvent | ClockedOutEvent;
}
/**
 * Canonical whitelist of UI-only `UserActivityEvent` variant names. Imported by
 * the api side (`POST /audit/user-activity`) to gate the FE-ingest endpoint:
 * any `event` value NOT in this set originates from a BE mutating handler and
 * must be rejected to prevent the FE from spoofing audit emissions.
 */
export declare const UI_ONLY_USER_ACTIVITY_VARIANTS: readonly ["Audit Trail Viewed", "Report Viewed", "Customer PII Viewed", "Cash Drawer UI Opened", "Cash Drawer UI Closed", "Export Initiated", "Impersonation UI Started", "Impersonation UI Ended", "Payment Viewed", "Invoice Viewed", "Customer Detail Viewed", "Supplier Account Viewed", "Search Performed", "Action Denied", "Two-Factor Challenge Shown", "Two-Factor Code Validation Failed", "Two-Factor Enrollment Started", "Two-Factor Recovery Codes Revealed", "Two-Factor Reset Initiated"];
export type UiOnlyUserActivityVariant = (typeof UI_ONLY_USER_ACTIVITY_VARIANTS)[number];
/**
 * Valid per-entity timeline entity types for the user-activity audit feed.
 * MUST stay in sync with the BE `VALID_ENTITY_TYPES` const in
 * `sinfactura/api/stacks/helpers/userActivity/query.ts`, which Zod-enums the
 * `entityType` query param. (That const moved out of
 * `stacks/lambdas/userActivity/_get.ts`, which still exists but no longer
 * holds it.) The BE const carries `satisfies readonly UserActivityEntityType[]`,
 * so widening this union is safe but narrowing it breaks the api build.
 *
 * `printer` and `printer_agent` are distinct types because their ids have
 * different uniqueness scope: `agentId` is unique store-wide, but `printerId`
 * is unique only WITHIN an agent — two agents can each report a printer under
 * the same id. A `printer` row must therefore key on the composite
 * `(agentId, printerId)` pair, never on `printerId` alone.
 */
export type UserActivityEntityType = 'order' | 'invoice' | 'supplier_invoice' | 'payment' | 'account' | 'customer' | 'supplier' | 'product' | 'user' | 'target_store' | 'brand' | 'category' | 'cash' | 'ticket' | 'report' | 'notification' | 'printer' | 'printer_agent' | 'attendance_shift';
/**
 * One tenant's last-activity roll-up — the newest activity timestamp across
 * every user in that tenant.
 *
 * ⚠️ **`lastActivityAt` is `number | null`, never optional and never `0`.**
 * Absence and zero must stay distinguishable: the operator grid renders an
 * em-dash for a tenant that has never been active, and a `0` epoch renders as
 * 1970. `null` is the only value that means "no activity recorded" — the same
 * hazard the courtesy-gift cutoff already carries. A tenant with no `ACTIVITY#`
 * rows is `null`; it is never omitted from the response and never `0`.
 *
 * ⚠️ This shape is **derivation-agnostic on purpose.** It says what reaches the
 * wire and nothing about where the value comes from — a mode on a consolidated
 * read, a projection, or a maintained per-tenant marker all satisfy it
 * identically. That is deliberate: the storage decision belongs to the activity
 * consolidation, and publishing the wire shape must not foreclose it.
 *
 * ⚠️ It is deliberately NOT a field on `TenantHealthEnvelope` — see the refusal
 * on that interface, which stands unchanged. That envelope is built by a Lambda
 * that cannot read the operational table, and this roll-up is served by the
 * user-activity function, which already owns it. Merging the two shapes would
 * re-create exactly the IAM widening the refusal exists to prevent.
 */
export interface TenantLastActivity {
    storeId: string;
    /** Epoch ms of the tenant's newest activity, or `null` if it has none. */
    lastActivityAt: number | null;
}
/**
 * `GET /platform/user-activity?mode=lastActivity` — cross-tenant, supervisorToken.
 *
 * ⚠️ **Per-row absence is a ROW-level concern.** A tenant with no activity is a
 * row carrying `lastActivityAt: null`, never a tenant missing from `data` and
 * never a page-level flag. A consumer must be able to tell "this tenant has no
 * activity" from "this page did not reach that tenant", and only a row can say
 * the former.
 *
 * `truncated` therefore means what it means everywhere else in this API — the
 * READ stopped short — and says nothing about any individual tenant's value.
 */
export interface TenantLastActivityResponse {
    message: string;
    data: TenantLastActivity[];
    truncated?: boolean;
    LastEvaluatedKey?: string;
}
