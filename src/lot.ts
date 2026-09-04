declare global {
  /**
   * One received batch of a lot-tracked product — the unit a recall, an expiry
   * sweep or a landed-cost allocation actually operates on.
   *
   * ⚠️ **`lotId` is server-minted and `lotCode` is not, and the two must never
   * be collapsed.** `lotCode` is what the supplier printed on the carton, and
   * two suppliers routinely stamp the same code (`L001`, `2024-A`) on unrelated
   * goods; the same supplier reuses codes across years. So the code cannot key
   * anything, cannot be assumed unique inside a store, and a recall matched on
   * it alone pulls stock that was never affected. `lotId` is the only identity.
   *
   * ⚠️ **A lot is store-wide, not per-location.** The row carries no
   * `warehouseId`, so a lot cannot answer "how many of this batch are in THAT
   * warehouse" — only "how many are in this store". `InventoryLevel` being
   * published does not change that: it scopes a BALANCE to a location, not a
   * batch, and its `expiryEarliest` is a denormalised hint rather than a
   * per-location lot breakdown. A consumer must not present a lot as a
   * per-location figure it cannot compute.
   */
  interface Lot {
    storeId: string;
    /** Server-minted identity — the only stable key. See the interface note on `lotCode`. */
    lotId: string;
    productId: string;
    /**
     * The batch identifier as the SUPPLIER printed it. Operator-facing and
     * operator-searchable, never a key: not unique, not validated, not
     * guaranteed present on goods that arrive unmarked.
     */
    lotCode?: string;
    /**
     * Unix ms the lot row was created. This is when the receipt was RECORDED,
     * which is not necessarily when the goods arrived — a back-dated receipt
     * carries `dated` for that, exactly as a movement row does.
     */
    createdAt: number;
    /** The `YYYYMMDD` day the goods physically arrived. */
    dated: number;
    supplierId?: string;
    /**
     * The purchase order this batch was received against, when there was one.
     * Absent on a lot created by a direct receipt or an opening-balance entry —
     * absence is a normal state, never a broken link.
     */
    purchaseOrderId?: string;

    /**
     * Units that ARRIVED in this batch. Immutable once written.
     *
     * ⚠️ It is NOT the units remaining. On-hand in this system is
     * `Σ INCOME − Σ SALE` over the movement partitions, and a stored remaining
     * counter here would be a second source of truth that drifts the first time
     * a movement is written without decrementing it. Remaining is derived by
     * summing the movement rows that carry this `lotId`.
     *
     * ⚠️ That derivation is only as good as the writers: nothing structurally
     * forces an outflow of a lot-tracked product to carry a `lotId`, so an
     * un-stamped sale depletes the product without depleting any lot, and the
     * lots then sum to more than on-hand. Treat a lot total that exceeds
     * `Product.stock` as un-stamped movements, not as a data-loss bug.
     */
    receivedQuantity: number;

    /**
     * Hard expiry — the day after which the units must NOT be sold, dispensed
     * or consumed. `YYYYMMDD`.
     */
    expiryDate?: number;
    /**
     * Quality date — the day after which the goods are still legal to sell but
     * no longer at their stated quality. `YYYYMMDD`.
     *
     * ⚠️ Distinct from `expiryDate` and not a synonym for it. Blocking a sale on
     * this date destroys saleable stock; letting a sale through on `expiryDate`
     * is a safety failure. A consumer that treats one as the other is wrong in
     * one of those two directions, so read the field it actually wants.
     *
     * ⚠️ Both are optional and nothing enforces that at least one is present. A
     * lot exists for traceability as well as shelf life — a serialised
     * component batch has neither date — so a missing date means "no shelf life
     * recorded", never "not yet filled in".
     */
    bestBefore?: number;

    /**
     * Per-unit acquisition cost of this batch INCLUDING the costs of getting it
     * onto the shelf that the supplier's unit price does not cover — freight,
     * customs, non-recoverable tax, handling.
     *
     * ⚠️ Deliberately distinct from the movement row's `cost`, which is the
     * invoice unit price. The two differ by exactly the allocation, and that
     * difference is the whole reason this field exists.
     *
     * ⚠️ Optional, permanently, because the freight invoice routinely arrives
     * after the goods. Absence means "no allocation has been performed" — a
     * valuation reader falls back to the movement row's `cost` rather than
     * treating the batch as free.
     *
     * ⚠️ Never push this onto `Product.cost`. That scalar is the last purchase
     * PRICE and the income path overwrites it on every receipt; writing a landed
     * figure there would silently reprice the catalogue against a cost basis no
     * operator quoted.
     */
    landedUnitCost?: number;

    /** Operator note about the batch. ⚠️ Never personal data — this row has no TTL and is not scrubbed. */
    notes?: string;
    /** Soft delete. A lot is never hard-deleted: movement rows reference `lotId` permanently. */
    disabled?: boolean;
  }
}

export {}; // NOSONAR
