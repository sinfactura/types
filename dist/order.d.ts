declare global {
    interface Order {
        storeId: string;
        orderId: string;
        customerId: string;
        customer: Partial<Customer>;
        createdAt: number;
        /**
         * `YYYYMMDD` in Buenos Aires time (e.g. `20260810`), stamped at creation
         * and never rewritten — the sort key of the `PK-dated` index the per-day
         * order queries run on. Required rather than optional: rows predating the
         * field were backfilled, and that one-shot migration has since been
         * removed as spent.
         */
        dated: number;
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
         * Expected payment due date, Unix ms. Nothing computes it from payment
         * terms — it is operator-declared.
         *
         * Feeds AFIP `FchVtoPago` at invoice time, which ARCA requires on every
         * service voucher (Concepto 2/3) and on every FCE regardless of Concepto
         * (code 10163). The FCE request's own `fchVtoPago` outranks it; absent
         * both, the voucher falls back to the invoice date, which is the
         * behaviour every goods order has always had.
         */
        dueDate?: number;
        /**
         * The service period this order bills for, Unix ms — the window that
         * reaches ARCA as `FchServDesde` / `FchServHasta`.
         *
         * Exists because a repair received in March and delivered in June is a
         * genuine multi-month service, and reporting it as a same-day June
         * service misstates the invoice. Absent on an ordinary goods order, which
         * then reports same-day exactly as before — the fields are additive and
         * change nothing for a sale that has no service period.
         *
         * Operator-declared, and validated on every write that can carry them:
         * `POST /orders` (both its insert and its update leg) rejects a
         * half-declared window and an end preceding its start, with a 400.
         * `mode: 'edit'` is strict and cannot carry them at all.
         *
         * They are therefore revisable before invoicing, which is what an operator
         * correcting a mistyped intake date needs. Revising them AFTER an invoice
         * exists does not rewrite it: the invoice stamps its own copy of the window
         * at issue time, so the issued voucher and the order can legitimately
         * disagree once someone edits the order.
         *
         * These are the SOURCE. `Invoice.serviceStartDate`/`serviceEndDate` are
         * the copy stamped at issue time; the ARCA drain rebuilds a pending
         * voucher from the live Order, so anything that must survive a
         * contingency drain belongs here rather than on the invoice.
         */
        serviceStartDate?: number;
        serviceEndDate?: number;
        /**
         * The `ServiceOrder` this order bills for, set when a delivered service
         * order mints its order. Absent on every ordinary goods order.
         *
         * An order carrying this holds the repair as two `isService: true` product
         * lines — labour and parts — priced so the PAIR SUMS to the service
         * order's own `total`. ⚠️ They are NOT priced off `laborCost` /
         * `partsCost`: those stay GROSS, and the ticket's absolute `discount` is
         * netted proportionally across the two lines at mint, with the second
         * derived from the first so rounding cannot leave the pair a centavo off
         * a fiscal document. Those lines are already-consumed work: the parts left
         * the shelf when the technician fitted them, so the order's stock
         * deduction skips a service line rather than moving inventory a second
         * time.
         *
         * `Order.discount` is a percentage and does NOT reach those lines — and
         * must not, since the two units cannot be added and converting between
         * them does not round-trip. The service order is the sole owner of its own
         * total (its own `discount` is already spent in the lines above), so the
         * figure invoiced is the figure the customer agreed to. The percentage
         * still applies normally to any goods bought in the same visit.
         */
        serviceOrderId?: string;
        /**
         * The `ServiceOrder` the ticket in `serviceOrderId` was a rework OF, copied
         * forward verbatim at mint. Absent unless that ticket is itself a rework.
         *
         * It is the parent SERVICE ORDER, not the parent order — a ticket-to-ticket
         * pointer, exactly as `ServiceOrder.parentServiceOrderId` stores it. The
         * resolved order was considered and rejected: the parent SERVICE# row
         * already carries its own `orderId` and `invoiceId`, so this is one point
         * read from the parent's money either way, and resolving at mint would add
         * a read inside the delivery transaction plus a "parent never delivered, so
         * it has no order" branch on a path whose only failure maps to
         * `409 SERVICE_ORDER_STATUS_CHANGED`.
         *
         * A statutory warranty rework (Ley 24.240 art. 23) deliberately does NOT
         * reopen the parent — that would destroy the parent's cycle time and its
         * invoice linkage. This field is what keeps the rework's paperwork joined
         * to the original repair without reopening anything. The sparse GSI
         * `PK-parentServiceOrderId` answers "every rework of parent X" directly —
         * keyed on the SERVICE partition and served by
         * `GET /services?parentServiceOrderId=`.
         */
        parentServiceOrderId?: string;
        /**
         * FK into `Store.deliveryMethods`. OPTIONAL, matching `Customer.deliveryMethod`
         * — `_deliverOrder.ts`'s mint already omits it when the store's catalog
         * resolves no canonical pickup method, and `orders/_post.ts`'s write-boundary
         * validation has always modelled it that way (`z.number().optional()`). A
         * required type here disagreed with what the api actually produces.
         *
         * ⚠️ Same reader contract as `Customer.deliveryMethod`: resolve against the
         * store's catalog and tolerate a miss, and don't read the id as meaningful on
         * its own — method ids are per-catalog ordinals.
         */
        deliveryMethod?: number;
        invoiceMethod?: {
            condFiscal: number;
            condFiscalName: string;
            cuit: string;
            razonSocial: string;
            /**
             * Explicit per-order ARCA receptor identity, decoupled from condFiscal
             * (ARCA DocTipo: 80 = CUIT, 96 = DNI, 99 = Consumidor Final — a
             * SEPARATE axis from condFiscal, sharing 96 only by coincidence).
             * When present, the AFIP invoice builder uses these directly for the
             * receptor instead of deriving from condFiscal.
             */
            docType?: number;
            docNumber?: string;
        };
        cost: number;
        total: number;
        discount: number;
        orderPrinted?: boolean;
        tagPrinted?: boolean;
        /**
         * Server-derived ms epoch, stamped by the WSS `ack` handler on an
         * `ACK_PRINTED` correlating to this row's CURRENT `printJobId`.
         * Absent = not confirmed printed — never seeded to `0`, unlike
         * `readyAt`/`deliveredAt`. Cleared on every reprint. Distinct from
         * `orderPrinted`, which is stamped optimistically at dispatch.
         */
        printedAt?: number;
        /** BE-minted pointer to the most recent print dispatch. Last-write-wins on reprint. */
        printJobId?: string;
        invoices?: Partial<Invoice>[];
        /**
         * Bounded, embedded projections of this order's returns, capped at 50.
         * The canonical rows live under `RETURN#${storeId}`.
         */
        returns?: ReturnSummary[];
        /**
         * Customer self-cancellation, DISTINCT from `disabled` (operator
         * soft-delete) — `disabled` additionally stamps
         * `readyAt`/`deliveredAt`/`deliveredDate`, which cancellation must NOT do.
         * All four fields are absent on a non-cancelled order.
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
     * Who initiated a cancellation. `customer` is the storefront self-service
     * path; `operator` is reserved for a future back-office cancellation,
     * still distinct from `disabled`.
     */
    type OrderCancellationSource = 'customer' | 'operator';
    /**
     * Machine-readable reason an order is locked against a mutation — the
     * payload of `409 ORDER_LOCKED` / `409 ORDER_CANCELLATION_LOCKED`, and the
     * gate a return checks before it starts. Clients map these to copy; never
     * user-facing strings themselves.
     *
     * ⚠️ Every predicate is a `> 0` test, NOT a presence test. `POST /orders`
     * stamps `readyAt`/`deliveredAt`/`deliveredDate` at `0` on creation, so an
     * `attribute_exists` check matches every order ever created and silently
     * inverts the lock. The api's `assessLock` is the reference.
     *
     * Evaluated in this order, first match wins:
     * - `ready` — `readyAt > 0`.
     * - `delivered` — `deliveredAt > 0` or `deliveredDate > 0`.
     * - `disabled` — `disabled === true` (soft-delete; NOT cancellation).
     * - `invoiced` — `invoices[]` holds a voucher that is not `rejected`/`voided`.
     *   A voucher with no `fiscalStatus` at all is legacy and counts as live.
     * - `payment-linked` — `linkedPayments` is non-empty. The platform never
     *   unlinks or refunds a provider payment on the operator's behalf.
     * - `cancelled` — `cancelledAt` is stamped.
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
