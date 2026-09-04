/**
 * Every reason an operator may give for a manual stock adjustment, as a runtime
 * value so the api's Zod enum, the app's picker and this union all derive from
 * ONE list instead of three copies that drift.
 *
 * The set is CLOSED on purpose. A free-text reason cannot be aggregated, so a
 * store could never answer "how much did we lose to breakage last quarter" —
 * which is the entire point of auditing adjustments rather than just applying
 * them. The free-text half of the story is `adjustmentNote`, which sits BESIDE
 * the category rather than replacing it.
 *
 * Adding a fifth reason is a patch bump and is safe: writers gain a value,
 * readers that switch exhaustively fail to compile until they handle it, and no
 * row already written changes meaning. REMOVING one is not — rows carrying it
 * are permanent and this platform never backfills.
 */
export const STOCK_ADJUSTMENT_REASONS = [
  "count_correction",
  "shrinkage",
  "breakage",
  "found",
] as const satisfies readonly StockAdjustmentReason[];

/**
 * Reasons that can only ever INCREASE on-hand, so the only ones legal on an
 * `INCOME#` adjustment row. `shrinkage`/`breakage` are absent because stock that
 * was stolen or destroyed cannot arrive.
 */
export const STOCK_INCOME_ADJUSTMENT_REASONS = [
  "count_correction",
  "found",
] as const satisfies readonly StockIncomeAdjustmentReason[];

/**
 * Reasons that can only ever DECREASE on-hand, so the only ones legal on a
 * `SALE#` adjustment row. `found` is absent because stock that was discovered
 * cannot deplete.
 */
export const STOCK_SALE_ADJUSTMENT_REASONS = [
  "count_correction",
  "shrinkage",
  "breakage",
] as const satisfies readonly StockSaleAdjustmentReason[];

/**
 * Byte-for-byte cap the writer must enforce on `adjustmentNote`. It is a note
 * justifying one movement, not a document: these rows live in two partitions
 * that are read by UNCAPPED walks with no TTL, so every byte is paid for on
 * every on-hand computation for the life of the tenant.
 *
 * Enforce it in BYTES (`Buffer.byteLength(note, 'utf8')`), never in
 * `String.length`. Spanish operator prose is accented, so a code-unit count
 * undercounts and lets an over-cap note through.
 */
export const MAX_STOCK_ADJUSTMENT_NOTE_BYTES = 280;

declare global {
  interface StockBase {
    storeId: string;
    stockId: string; // e.g. "income-PROD000330"
    createdAt: number; // insertion timestamp
    cost: number;
    skip?: boolean; // supersedes legacy notEvaluate; unused on new inserts
  }

  /**
   * Attributes persisted on every stock-movement row. `storeId` and `stockId`
   * deliberately do not belong here: the DynamoDB partition and sort keys carry
   * them, and stock readers synthesize the public hydrated fields from those
   * keys. Writers must use a stored shape so the compiler checks every attribute
   * that is actually sent to DynamoDB.
   */
  interface StoredStockBase {
    createdAt: number;
    cost: number;
    skip?: boolean;
  }

  /**
   * Why an operator moved stock by hand, rather than through a purchase, a sale
   * or a return. Presence of this field on a movement row is what MAKES the row
   * an adjustment — there is no other discriminator and no separate partition.
   *
   * `count_correction` is the only value legal in both directions: a physical
   * count can come out above or below the system figure. The other three are
   * one-directional and are split into the two narrower unions below, so the
   * compiler — not a runtime refinement — refuses a `breakage` that increases
   * stock or a `found` that decreases it.
   */
  type StockAdjustmentReason =
    | "count_correction"
    | "shrinkage"
    | "breakage"
    | "found";

  /** Adjustment reasons legal on an `INCOME#` row (on-hand goes UP). */
  type StockIncomeAdjustmentReason = "count_correction" | "found";

  /** Adjustment reasons legal on a `SALE#` row (on-hand goes DOWN). */
  type StockSaleAdjustmentReason =
    | "count_correction"
    | "shrinkage"
    | "breakage";

  interface StockIncomeWrite extends StoredStockBase {
    dated: number;
    quantity: number;
    supplierId?: string;
    supplierName?: string;

    /**
     * The purchase order this receipt was booked against, and the INDEX of the
     * line within that order's `items`.
     *
     * The index is what makes short-shipment expressible at all: one order
     * legitimately carries the same product on several lines at different
     * prices or delivery dates, so a receipt attributed by `productId` alone
     * would collapse them and mark the wrong line delivered. This mirrors how a
     * return addresses an order line.
     *
     * These rows are the AUTHORITY for how much of an order has arrived;
     * `PurchaseOrderItem.receivedQuantity` is a projection of them kept so the
     * order renders without a ledger walk.
     *
     * ⚠️ Both ABSENT is the normal state, not a broken link — a direct receipt
     * with no paperwork, an opening balance, or any row written before purchase
     * orders existed. Never treat absence as a migration gap.
     *
     * ⚠️ Presence does NOT exclude a row from purchase/supplier COST views the
     * way `returnId` and `adjustmentReason` do. The opposite: a receipt against
     * an order is the most ordinary purchase there is.
     */
    purchaseOrderId?: string;
    /** Index into the ordering `PurchaseOrder.items`. Present alongside `purchaseOrderId`. */
    purchaseOrderItemIndex?: number;

    /**
     * The batch these units arrived as, on a lot-tracked product.
     *
     * The `Lot` row records what ARRIVED and never changes; what REMAINS of a
     * batch is derived by summing the movement rows carrying its `lotId`, in
     * both partitions. That is deliberate — a stored remaining counter on the
     * lot would be a second source of truth beside `Σ INCOME − Σ SALE`, and it
     * would drift the first time a movement was written without decrementing
     * it.
     *
     * ⚠️ Nothing structurally forces this onto a row for a lot-tracked product,
     * so an un-stamped receipt adds stock that belongs to no batch and the lots
     * then sum to LESS than on-hand. The writer owes the stamp.
     */
    lotId?: string;

    /**
     * Set when this inflow is a customer RETURN restocking a sellable unit,
     * not a supplier purchase. Rides the `INCOME#` partition deliberately —
     * on-hand is `Σ INCOME − Σ SALE`, so reusing it needs no reader change.
     * Presence of `returnId` is the discriminator — purchase/supplier COST
     * views MUST exclude rows that carry it.
     *
     * ⚠️ Never set `skip`/`notEvaluate` on a return income row — that would
     * exclude it from the on-hand sum and silently lose the restocked unit.
     */
    returnId?: string;
    /** Originating order, for traceability. Present alongside `returnId`. */
    orderId?: string;
    /** Index of the returned line in the originating `Order.items`. */
    orderItemIndex?: number;

    /**
     * Set when this inflow is a manual upward ADJUSTMENT — a physical count
     * that came out above the system figure, or stock found after being
     * written off. Rides the `INCOME#` partition for the same reason
     * `returnId` does: on-hand is `Σ INCOME − Σ SALE`, so an adjustment that
     * reuses the partition needs no reader change at all. A separate `ADJUST#`
     * partition would force every existing ledger reader to learn a third
     * query and a sign convention, and any reader that was missed would
     * silently under-count on-hand rather than fail.
     *
     * ⚠️ ABSENT means "this is a purchase or a return", which is what every
     * row written before this field existed is. Absence is a permanent, legal
     * state of the data — never treat it as a migration gap.
     *
     * ⚠️ `quantity` on an adjustment row is ALWAYS POSITIVE. Direction is
     * carried by WHICH partition the row lands in, never by the sign: a
     * downward adjustment is a `SALE#` row, not a negative `INCOME#` row.
     * Nothing structurally forbids a negative here, so the writer owes the
     * check.
     *
     * ⚠️ `cost` on an adjustment row is the product's CURRENT cost, recorded
     * so the write-off has a value. Nothing was purchased, so the writer must
     * NOT push it onto `Product.cost` the way the income path does — an
     * upward count correction is not a repricing event.
     *
     * ⚠️ Purchase/supplier COST views MUST exclude rows carrying this field,
     * exactly as they already exclude `returnId` rows. Found stock is not a
     * purchase.
     */
    adjustmentReason?: StockIncomeAdjustmentReason;

    /**
     * Operator's free-text justification for the adjustment. Present only
     * alongside `adjustmentReason`; the category is what makes adjustments
     * aggregatable, and this is what makes one specific adjustment defensible
     * at a stocktake ("shelf 3, water damage").
     *
     * Capped at `MAX_STOCK_ADJUSTMENT_NOTE_BYTES`, measured in UTF-8 bytes.
     *
     * ⚠️ NEVER put personal data in it (names, CUIT, email, card fragments).
     * It is operator-authored, is not scrubbed by anything, and rides an
     * append-only partition with no TTL — so a leak here is permanent.
     */
    adjustmentNote?: string;

    /**
     * Groups the many adjustments that one physical stock-count session emits
     * when it is finalised, so the whole count can be reviewed, exported or
     * disputed as a unit instead of as N unrelated movements.
     *
     * Published NOW, before any adjustment row exists, precisely because a
     * correlation id cannot be added afterwards: this platform is forward-only
     * and rows already written would never receive one.
     *
     * Caller-supplied and opaque to the ledger. Constrain it to 1–64 chars of
     * `[A-Za-z0-9_-]` so that a future server-minted stocktake id (`STK000001`,
     * the repo's padded-counter shape) is a legal value and rows written before
     * that entity exists stay readable beside rows written after it.
     *
     * ⚠️ NOT a general-purpose batch id. A bulk import correction or a
     * migration must not borrow it — it names one real-world thing, a physical
     * count session, and a second meaning would make the grouping unusable for
     * both.
     */
    stocktakeId?: string;
  }

  interface StockSaleWrite extends StoredStockBase {
    /**
     * Units leaving stock on this outflow. REQUIRED, mirroring
     * `StockIncomeWrite.quantity` — on-hand is `Σ INCOME − Σ SALE`, so a SALE
     * row without it cannot participate in the sum at all.
     */
    quantity: number;
    /**
     * The `YYYYMMDD` day this outflow happened, mirroring
     * `StockIncomeWrite.dated`. It exists so the SALES half of a product's
     * movement history can be range-queried by date at all — the income half
     * always could, and the asymmetry meant a date-bounded movement report was
     * structurally impossible on one leg of `Σ INCOME − Σ SALE`.
     *
     * ⚠️ OPTIONAL, permanently. Every `SALE#` row written before this field
     * existed has no `dated`, this platform never backfills, and those rows stay
     * readable: the existing reader derives a day from the sort key's
     * `${productId}-${createdAt}` shape. Absence is a legal, permanent state of
     * the data — never a migration gap, and never a reason to make it required.
     *
     * ⚠️ It is the day of the MOVEMENT, not the day the row was written. On a
     * back-dated adjustment the two differ, and the movement's own day is the
     * one a stock report is asking about.
     */
    dated?: number;
    customerId?: string;
    fullName?: string;
    ivaType?: number;
    orderId?: string;
    /**
     * Set when the outflow is a PART consumed on a service order rather than a
     * product sold on an order. Rides the `SALE#` partition deliberately —
     * on-hand is `Σ INCOME − Σ SALE`, so a part fitted to a repair depletes
     * stock through the path that already exists and needs no reader change.
     *
     * Presence of `serviceOrderId` is the discriminator, mirroring
     * `StockIncome.returnId`: a row carrying it has no `orderId`, and any view
     * that attributes revenue to ORDERS must exclude it or the same money is
     * counted under both.
     */
    serviceOrderId?: string;
    price?: number;

    /**
     * The batch these units left from, on a lot-tracked product. Same field,
     * same derivation and same forward-only rules as
     * `StockIncomeWrite.lotId` — what remains of a batch is
     * `Σ INCOME − Σ SALE` restricted to rows carrying it.
     *
     * ⚠️ An un-stamped outflow of a lot-tracked product depletes the PRODUCT
     * without depleting any BATCH, so the lots then sum to MORE than on-hand.
     * A lot total above `Product.stock` is that, not data loss — and it is why
     * a recall computed from lots alone can overstate what is on the shelf.
     */
    lotId?: string;

    /**
     * The per-unit valuation actually CONSUMED by this outflow, under the
     * method named in `valuationMethod`.
     *
     * ⚠️ **Deliberately distinct from `cost`, and the distinction is the entire
     * point.** `cost` on an outflow is the product's CURRENT cost — the price of
     * the most recent receipt, which the income path writes straight onto
     * `Product.cost`. Valuing every outflow at latest-cost is neither weighted
     * average nor FIFO, which is why the two methods cannot produce different
     * numbers today. This field is what lets them: a WAC writer stamps the
     * running average as it stood when the units left, a FIFO writer stamps
     * what the consumed layers actually cost.
     *
     * ⚠️ **A FIFO outflow that straddles several layers is LOSSY here.** One
     * scalar cannot carry three layer prices, so the stamp is the weighted
     * figure for this movement and the layer breakdown is not recoverable from
     * the row — reconstructing it means replaying the ledger. A consumer must
     * not present this as a layer cost.
     *
     * ⚠️ ABSENT means the row was never valued under a method, which is every
     * row written before this field existed and every row a writer that does no
     * valuation produces. A reader falls back to `cost`; it must not infer that
     * the valuation was zero, and it must not infer that a method was applied.
     *
     * ⚠️ Extended value is `unitCost * quantity` — the partition supplies the
     * sign, exactly as it does for the quantity itself. A stored extended total
     * is deliberately absent: it would be a second figure that can disagree
     * with its own factors.
     */
    unitCost?: number;

    /**
     * Which costing method produced `unitCost`. Present only alongside it.
     *
     * ⚠️ **Stamped on the ROW on purpose — never read the store's current
     * setting to interpret a historical outflow.** An operator who switches
     * methods is deciding how the NEXT movement is valued; a report that applies
     * today's setting to rows valued under the old one silently restates closed
     * periods, and no one sees the restatement because the rows themselves did
     * not change.
     */
    valuationMethod?: ValuationMethod;

    /**
     * Set when this outflow is a manual downward ADJUSTMENT — shrinkage,
     * breakage, or a physical count that came out below the system figure.
     * Rides the `SALE#` partition for the same reason `serviceOrderId` does:
     * on-hand is `Σ INCOME − Σ SALE`, so an outflow that reuses the partition
     * needs no reader change at all.
     *
     * ⚠️ ABSENT means "this is a sale or a service part", which is what every
     * row written before this field existed is. Absence is a permanent, legal
     * state of the data — never treat it as a migration gap.
     *
     * ⚠️ `quantity` is ALWAYS POSITIVE here, as on every other outflow: it is
     * subtracted, so the depletion is already expressed. Do not reach for the
     * signed-quantity convention the service-parts RESTORE path uses — that
     * negative row exists to undo a specific earlier consumption, which an
     * adjustment never does.
     *
     * ⚠️ A row carrying this field has NO `price` and must never be given one.
     * Shrinkage is not revenue, and any view that attributes revenue MUST
     * exclude these rows, exactly as it already excludes `serviceOrderId`
     * rows. `cost` is still required and carries the product's current cost,
     * which is what makes the write-off valuable.
     */
    adjustmentReason?: StockSaleAdjustmentReason;

    /**
     * Operator's free-text justification for the adjustment. Present only
     * alongside `adjustmentReason`. Capped at
     * `MAX_STOCK_ADJUSTMENT_NOTE_BYTES`, measured in UTF-8 bytes.
     *
     * ⚠️ NEVER put personal data in it. It is operator-authored, is not
     * scrubbed by anything, and rides an append-only partition with no TTL.
     */
    adjustmentNote?: string;

    /**
     * Groups the many adjustments one physical stock-count session emits on
     * finalise. Same field, same rules and same forward-only rationale as
     * `StockIncomeWrite.stocktakeId` — a single count produces rows in BOTH
     * partitions (products counted short go to `SALE#`, products counted long
     * to `INCOME#`), so the id has to exist on both or half of every count is
     * ungroupable.
     */
    stocktakeId?: string;
  }

  /** Hydrated movement returned by readers after deriving ids from DynamoDB keys. */
  interface StockIncome extends StockBase, StockIncomeWrite {}

  /** Hydrated movement returned by readers after deriving ids from DynamoDB keys. */
  interface StockSale extends StockBase, StockSaleWrite {}
}

export {}; // NOSONAR
