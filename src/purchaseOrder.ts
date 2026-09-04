/**
 * Every state a purchase order can hold, as a runtime value so the api's Zod
 * enum, the operator's filter chips and the union all derive from ONE list.
 *
 * The order of the tuple is the lifecycle order and is meaningful to a UI that
 * renders a progress rail; it is NOT an ordering the server may compare on.
 * `cancelled` is terminal and reachable from anywhere before `received`, so a
 * numeric "later than" derived from this index is wrong for that member.
 */
export const PURCHASE_ORDER_STATUSES = [
  'draft',
  'sent',
  'partially_received',
  'received',
  'cancelled',
] as const satisfies readonly PurchaseOrderStatus[];

declare global {
  /**
   * - `draft` — being composed; the supplier has not seen it and nothing is
   *   expected to arrive.
   * - `sent` — issued to the supplier; goods are outstanding.
   * - `partially_received` — at least one receipt has landed and the operator
   *   has not closed the order.
   * - `received` — the operator CLOSED the order as received.
   * - `cancelled` — abandoned.
   *
   * ⚠️ **`received` does NOT mean the received quantities equal the ordered
   * quantities.** A short delivery that the operator accepts as final closes the
   * order, and that is the common case, not an edge one — suppliers under-ship.
   * A reader that infers "everything arrived" from this member will report
   * phantom stock. The received quantities are the only answer to that question.
   *
   * ⚠️ **`cancelled` reverses nothing.** Receipts already ledgered stay
   * ledgered: they are real goods that really arrived, and on-hand is
   * `Σ INCOME − Σ SALE` over rows that this status has no power over. Cancelling
   * an order that was partially received is legal and means "expect no more",
   * never "un-receive what came".
   */
  type PurchaseOrderStatus =
    | 'draft'
    | 'sent'
    | 'partially_received'
    | 'received'
    | 'cancelled';

  /**
   * A commitment to buy from a supplier — the document that exists BEFORE any
   * stock moves, which is precisely what the inbound side has never had. A
   * receipt today is an unheralded `INCOME#` row with a supplier name on it;
   * there is no record of what was expected, so nothing can be short-shipped,
   * chased, or reconciled against an invoice.
   *
   * ⚠️ **This entity carries no stock.** Creating, sending or closing one moves
   * nothing: on-hand changes only when a receipt writes a movement row carrying
   * this `purchaseOrderId`. Keeping the commitment and the ledger separate is
   * what allows a partial delivery to be expressed at all.
   */
  interface PurchaseOrder {
    storeId: string;
    purchaseOrderId: string;
    /** Unix ms the order was created. */
    createdAt: number;
    updatedAt?: number;
    /** The operator who raised it. */
    userId: string;

    supplierId: string;
    /**
     * Supplier name DENORMALIZED at write time, mirroring the movement row's
     * `supplierName`. The order is a historical document: it records who was
     * bought from under the name they traded as then, so a later rename of the
     * `SUPPLIER` row must not rewrite it.
     */
    supplierName?: string;

    status: PurchaseOrderStatus;
    items: PurchaseOrderItem[];

    /** The `YYYYMMDD` day the order was raised. */
    dated: number;
    /** The `YYYYMMDD` day the supplier committed to deliver, when they committed to one. */
    expectedAt?: number;
    /** Unix ms the order was issued to the supplier — the `draft` → `sent` transition. */
    sentAt?: number;
    /** Unix ms the operator closed the order. Set for `received` and `cancelled` alike. */
    closedAt?: number;

    /**
     * Currency catalogId, plus the FX rate and the instant it was effective.
     * Self-describing (ADR-0013): a purchase order is frequently placed in a
     * currency the store does not report in, and a rate read at report time
     * instead of at commitment time restates a settled obligation every day the
     * rate moves.
     */
    currency: string;
    currencyValue?: number;
    currencyValueAt?: number;

    /** Sum of `quantity * unitCost` over the lines, in this order's currency, before tax. */
    subtotal: number;
    /**
     * What the order commits the store to pay, in this order's currency.
     *
     * ⚠️ STORED, not derived. Freight, a negotiated discount and rounding all
     * land here and none of them are expressible on a line, so a reader that
     * re-sums the lines will disagree with the supplier's own document.
     */
    total: number;

    /** Operator note. ⚠️ Never personal data — this row is not scrubbed and has no TTL. */
    notes?: string;
    /** Lowercase '#'-joined write-side index. Internal; not part of the read contract. */
    search?: string;
    /** Soft delete. Movement rows reference `purchaseOrderId` permanently, so an order is never hard-deleted. */
    disabled?: boolean;
  }

  /**
   * One ordered line.
   *
   * ⚠️ **Lines are addressed by ARRAY INDEX, never by `productId`.** One order
   * legitimately carries the same product on several lines — two delivery dates,
   * two negotiated prices, two lots — and a receipt attributed by productId
   * would collapse them and credit the wrong line. This mirrors how returns
   * address order lines, for the same reason.
   */
  interface PurchaseOrderItem {
    productId: string;
    /** Name DENORMALIZED at write time; the order records what was ordered, under the name it had then. */
    name: string;
    sku?: string;
    /** Units ordered. */
    quantity: number;
    /**
     * Agreed per-unit purchase price, in the ORDER's currency, before tax.
     *
     * ⚠️ NOT a landed cost — it excludes freight, customs and handling. The
     * landed figure is allocated later and belongs on the received `Lot`, since
     * the allocation is only knowable per batch and often only after the goods
     * have arrived.
     */
    unitCost: number;
    ivaType?: number;

    /**
     * Units received against this line so far.
     *
     * ⚠️ A PROJECTION, not the authority. The authority is the set of `INCOME#`
     * movement rows carrying this order's `purchaseOrderId` and this line's
     * index; this field exists so the order renders without a ledger walk. When
     * the two disagree, the ledger is right — it is what on-hand was computed
     * from.
     *
     * ⚠️ May legally EXCEED `quantity`: suppliers over-ship, and refusing to
     * record goods that are physically on the shelf would put the ledger at odds
     * with reality to protect a number. Absent means nothing has been received.
     */
    receivedQuantity?: number;
  }
}

export {}; // NOSONAR
