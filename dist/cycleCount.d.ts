/**
 * Every state a count session can hold, as a runtime value so the api's Zod
 * enum, the operator's filter and the union all derive from ONE list.
 */
export declare const CYCLE_COUNT_STATUSES: readonly ["open", "finalized", "cancelled"];
declare global {
    /**
     * - `open` — being counted; lines may still be added and revised, and nothing
     *   has moved.
     * - `finalized` — the variances were applied and the adjustment rows exist.
     * - `cancelled` — abandoned without applying anything.
     *
     * ⚠️ **`finalized` is terminal and irreversible.** Finalising writes movement
     * rows into append-only partitions; this platform never backfills and never
     * deletes them, so "un-finalising" would mean a second count in the opposite
     * direction, which is a new session and not a state change here. A UI that
     * offers an undo on a finalized session is promising something the ledger
     * cannot do.
     */
    type CycleCountStatus = 'open' | 'finalized' | 'cancelled';
    /**
     * A physical count session that the SERVER owns — an id, a stored line set,
     * and a read path. It exists because a stocktake has been a purely
     * client-side construct: the count lived in one browser, no id was minted,
     * nothing indexed it, and a session lost mid-count was simply gone.
     *
     * ⚠️ **`cycleCountId` IS the value written into `stocktakeId` on the movement
     * rows** this session emits when it finalises. That field was published ahead
     * of this entity precisely so the two would meet without a backfill, and it
     * constrains what a legal id looks like: 1–64 characters of `[A-Za-z0-9_-]`.
     * Minting an id outside that charset silently orphans every adjustment the
     * session produces, because the grouping field will not accept it and this
     * platform is forward-only.
     *
     * ⚠️ **A count is not a lock.** Nothing freezes stock while the session is
     * open: sales keep depleting and receipts keep adding, so a variance computed
     * from a `systemQuantity` captured minutes earlier attributes real trade to
     * miscounting. The longer a session stays `open`, the more of its variance is
     * legitimate movement. That is inherent, not a defect to design around here —
     * but a consumer must not present the variance as shrinkage.
     */
    interface CycleCount {
        storeId: string;
        /** Server-minted. ⚠️ Must satisfy the `stocktakeId` charset — see the interface note. */
        cycleCountId: string;
        /** Unix ms the session was opened. */
        createdAt: number;
        updatedAt?: number;
        /** The operator who opened it. */
        userId: string;
        status: CycleCountStatus;
        /** The `YYYYMMDD` day the count was taken. */
        dated: number;
        /**
         * Operator-facing label for the session ("Depósito, estante 3"). Prose, for
         * a human reading a list of past counts; nothing derives from it.
         */
        name?: string;
        /**
         * The `Product.zone` this session was scoped to, when it was scoped at all.
         *
         * ⚠️ Descriptive, not a guarantee. It records what the operator SAID they
         * were counting; nothing forces every line to belong to that zone, and
         * nothing forces every product in that zone to appear. A zoned session is
         * not evidence that the zone was counted completely.
         */
        zone?: string;
        items: CycleCountItem[];
        /** Unix ms the variances were applied. Present only on a `finalized` session. */
        finalizedAt?: number;
        /** The operator who applied them — not necessarily the one who opened the session. */
        finalizedBy?: string;
        /** Operator note. ⚠️ Never personal data — this row is not scrubbed and has no TTL. */
        notes?: string;
        /** Lowercase '#'-joined write-side index. Internal; not part of the read contract. */
        search?: string;
        disabled?: boolean;
    }
    /**
     * One counted product.
     *
     * A line whose `countedQuantity` equals its `systemQuantity` still belongs in
     * the session: "we looked and it was right" is the evidence a count exists to
     * produce, and dropping matching lines makes a completed count
     * indistinguishable from an abandoned one.
     */
    interface CycleCountItem {
        productId: string;
        /** Name and SKU DENORMALIZED at count time, so a later catalogue rename does not rewrite history. */
        name?: string;
        sku?: string;
        /**
         * On-hand as the SYSTEM believed it at the moment this line was captured —
         * a snapshot, stored rather than recomputed at finalise.
         *
         * ⚠️ It is stored precisely so the variance stays reproducible. Recomputing
         * it at finalise would make the applied adjustment disagree with the number
         * the operator was shown while counting, and the operator's number is the
         * one they signed off.
         */
        systemQuantity: number;
        /** What the operator physically counted. */
        countedQuantity: number;
        /**
         * The batch counted, when the product is lot-tracked.
         *
         * ⚠️ Optional even on a lot-tracked product, because a real count often
         * cannot attribute units to a batch — mixed shelf stock, a rubbed-off
         * carton code. Absence means "counted, batch unknown", never "not
         * lot-tracked", so an adjustment from such a line depletes the product
         * without depleting any lot.
         */
        lotId?: string;
        /** Why the line differs. ⚠️ Never personal data — it rides into an un-scrubbed, TTL-less row. */
        note?: string;
        /** Unix ms this line was captured. Its distance from `finalizedAt` is how stale `systemQuantity` is. */
        countedAt?: number;
    }
}
export {};
