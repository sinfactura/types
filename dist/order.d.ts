declare global {
    interface Order {
        storeId: string;
        orderId: string;
        customerId: string;
        customer: Partial<Customer>;
        createdAt: number;
        updatedAt?: number;
        readyAt?: number;
        deliveredAt?: number;
        deliveredDate?: number;
        comments?: string;
        currency: string;
        currencyValue?: number;
        currencyValueAt?: number;
        paymentMethod: number;
        /**
         * Expected payment due date, Unix ms (api#713 / types#110).
         *
         * Optional and forward-only. Purely declarative in v1: nothing in the
         * platform computes it from payment terms (Net 15/30, per-customer
         * credit days) — that is a separate product decision. An Invoice issued
         * against this order may inherit it or set its own independently.
         */
        dueDate?: number;
        deliveryMethod: number;
        invoiceMethod?: {
            condFiscal: number;
            condFiscalName: string;
            cuit: string;
            razonSocial: string;
            docType?: number;
            docNumber?: string;
        };
        cost: number;
        total: number;
        discount: number;
        orderPrinted?: boolean;
        tagPrinted?: boolean;
        /**
         * Server-derived ms epoch (api#642), stamped by the WSS `ack` handler on an
         * `ACK_PRINTED` that correlates to this row's CURRENT `printJobId`.
         *
         * **Absent = not confirmed printed** — never seeded to `0`, unlike
         * `readyAt`/`deliveredAt`. Cleared on every reprint, so it only ever
         * describes the current `printJobId`. Distinct from `orderPrinted`, which is
         * stamped optimistically at dispatch and reads `true` even with no printer
         * connected. A tag/label print never sets this.
         */
        printedAt?: number;
        /** BE-minted pointer to the most recent print dispatch (api#642). Last-write-wins on reprint. */
        printJobId?: string;
        invoices?: Partial<Invoice>[];
        /**
         * Bounded, embedded projections of this order's returns (api#547),
         * capped at 50. The canonical rows live under `RETURN#${storeId}`.
         *
         * ⚠️ Element type narrowed from `Partial<Return>` to `ReturnSummary` in
         * types#111. Safe: the returns feature is unbuilt, so nothing produced or
         * consumed this field at the time of the change.
         */
        returns?: ReturnSummary[];
        /**
         * Customer self-cancellation (api#591). Cancelled is a DISTINCT state
         * from `disabled` (operator soft-delete) — do not conflate them, and note
         * that `disabled` additionally stamps `readyAt`/`deliveredAt`/
         * `deliveredDate`, which cancellation must NOT do.
         *
         * All four are absent on a non-cancelled order.
         */
        cancelledAt?: number;
        /** Who cancelled: the customerId for a self-cancellation, else the userId. */
        cancelledBy?: string;
        cancellationSource?: OrderCancellationSource;
        /** Bounded free text supplied by the canceller. */
        cancellationReason?: string;
        mercadolibreCreditNote?: {
            creditNoteNumber?: number;
            emittedAt?: number;
            status?: "emitted" | "skipped" | "failed";
            reason?: string;
            claimId?: string;
            source?: 'auto' | 'manual';
        };
        disabled?: boolean;
        items: Partial<BasketItem>[];
        rating?: number;
        comment?: string;
        surveyDate?: number;
        deliveryAddress?: {
            fullName: string;
            address: string;
            phone: string;
            city: string;
            province: string;
            postalCode: string;
        };
        mercadopago?: {
            dynamicQr?: {
                qrData: string;
                inStoreOrderId: string;
                posId: string;
                externalReference: string;
                amount: number;
                currency: string;
                expiresAt: number;
                createdAt: number;
            };
        };
        linkedPayments?: Record<string, LinkedPaymentEntry>;
        channel?: OrderChannel;
        mercadolibre?: OrderMercadolibre;
    }
    type OrderChannel = 'meli';
    /**
     * Who initiated a cancellation (api#591). `customer` is the storefront
     * self-service path; `operator` is reserved for a future back-office
     * cancellation that is still distinct from `disabled`.
     */
    type OrderCancellationSource = 'customer' | 'operator';
    /**
     * Machine-readable reason an order is locked against a mutation — the
     * payload of `409 ORDER_LOCKED` (order edit, api#546) and
     * `409 ORDER_CANCELLATION_LOCKED` (customer self-cancellation, api#591),
     * and the gate a return checks before it starts (api#547).
     *
     * Clients map these to copy; they are never user-facing strings themselves.
     *
     * ⚠️ The predicate behind every member is a `> 0` test, NOT a presence test.
     * `POST /orders` stamps `readyAt: 0`, `deliveredAt: 0` and `deliveredDate: 0`
     * at creation, so EVERY order carries all three fields — an
     * `attribute_exists`/"is present" check matches every order ever created and
     * silently inverts the lock. The api's shipped implementation
     * (`assessLock`, api#591) is the reference.
     *
     * Evaluated in this order, first match wins:
     * - `ready` — `readyAt > 0`.
     * - `delivered` — `deliveredAt > 0` or `deliveredDate > 0`.
     * - `disabled` — `disabled === true` (soft-delete; NOT cancellation).
     * - `invoiced` — `invoices[]` holds a voucher that is not `rejected`/`voided`.
     *   A voucher with no `fiscalStatus` at all is legacy and counts as live.
     * - `payment-linked` — `linkedPayments` is non-empty. The platform never
     *   unlinks or refunds a provider payment on the operator's behalf.
     * - `cancelled` — `cancelledAt` is stamped (api#591).
     */
    type OrderLockReason = 'ready' | 'delivered' | 'disabled' | 'invoiced' | 'payment-linked' | 'cancelled';
    interface MercadolibreCreditNoteStamp {
        creditNoteNumber?: number;
        emittedAt?: number;
        status?: 'emitted' | 'skipped' | 'failed';
        reason?: string;
        claimId?: string;
        source: 'manual' | 'auto';
    }
    interface OrderMercadolibre {
        mlOrderId: string;
        packId?: string;
        buyerNickname?: string;
        shipmentId?: string;
        logisticType?: string;
        mlLastUpdated?: number;
        paid?: boolean;
        items?: OrderMercadolibreItem[];
        fees?: {
            saleFee?: number;
            shippingCostSeller?: number;
            currency: string;
            currencyValue?: number;
            currencyValueAt?: number;
        };
        billingInfo?: {
            docType?: string;
            docNumber?: string;
            custType?: 'CO' | 'BU';
            taxpayerType?: string;
            iibbNumber?: string;
        };
        discrepancies?: {
            priceMismatch?: boolean;
            oversell?: boolean;
            missingCuit?: boolean;
        };
        fiscalDocumentStatus?: 'uploaded' | 'failed' | 'pending';
    }
    interface OrderMercadolibreItem {
        mlItemId: string;
        variationId?: string;
        userProductId?: string;
        sellerSku?: string;
        quantity: number;
        stock?: {
            mlStoreId?: string;
            networkNodeId?: string;
        }[];
    }
    interface LinkedPaymentEntry {
        source: 'mp' | 'stripe' | 'mp_movement';
        total: number;
        linkedAt: number;
    }
    interface ZebraTag {
        orderId: string;
        fullName: string;
        phone: string;
        address: string;
        city: string;
        quantity: number;
        comments: string;
        sender: {
            razonSocial: string;
            cuit: string;
            phone: string;
            address: string;
            city: string;
            postalCode: string;
            province: string;
        };
    }
}
export {};
