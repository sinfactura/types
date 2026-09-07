/**
 * Every movement type the warehouse ledger can record, as a runtime value so
 * the api's Zod enum, the operator's filter chips and the union all derive from
 * ONE list instead of three copies that drift.
 *
 * ⚠️ **The tuple is NOT a partition of on-hand.** `reservation` and `release`
 * move `InventoryLevel.reserved`, not `onHand`, so a naive `Σ quantity` over a
 * product's partition double-counts every hold. See `StockMovementType`.
 */
export declare const STOCK_MOVEMENT_TYPES: readonly ["receipt", "sale", "transfer_in", "transfer_out", "adjustment", "return", "reservation", "release", "write_off"];
/**
 * Why an operator moved stock by hand. Runtime value for the same
 * one-list-not-three reason as `STOCK_MOVEMENT_TYPES`.
 *
 * ⚠️ This is a SUPERSET of `StockAdjustmentReason` with different spellings for
 * two overlapping members — see `StockMovementReason` for the mapping a
 * migration owes.
 */
export declare const STOCK_MOVEMENT_REASONS: readonly ["count_correction", "shrinkage", "damage", "expiry", "theft", "admin_error", "other"];
/** Every state an individual hold can hold. Runtime value for the api's Zod enum. */
export declare const RESERVATION_STATUSES: readonly ["active", "released", "expired", "consumed"];
/**
 * Every state a stock transfer can hold, as a runtime value.
 *
 * The order of the tuple is the lifecycle order and is meaningful to a UI that
 * renders a progress rail; it is NOT an ordering the server may compare on.
 * `cancelled` is terminal and reachable from anywhere before `received`, so a
 * numeric "later than" derived from this index is wrong for that member.
 */
export declare const STOCK_TRANSFER_STATUSES: readonly ["draft", "in_transit", "partially_received", "received", "cancelled"];
/** How a multi-location store picks which warehouse fills a line. Runtime value for the settings picker. */
export declare const ALLOCATION_STRATEGIES: readonly ["manual", "primary", "sort_order", "most_available"];
/**
 * Zero-padding width for the epoch-millisecond component of a movement sort
 * key. Thirteen digits is the width of a millisecond epoch until the year 2286,
 * and the padding is what makes the key sort correctly at all.
 *
 * ⚠️ Pad with this constant, never with a literal, and never omit it. DynamoDB
 * sort keys of type S compare LEXICOGRAPHICALLY, so an unpadded epoch orders
 * `'999...'` after `'1000...'` — a ledger that silently interleaves once the
 * digit count changes. The two shipped time-ordered ledgers in this platform
 * (the audit trail and the print-job log) both pad to this width; a third
 * spelling here would be a third convention.
 */
export declare const MOVEMENT_SORT_KEY_TIMESTAMP_WIDTH = 13;
declare global {
    /**
     * One physical stock location a store holds goods in — a shop floor, a
     * back room, a depósito, a consignment site.
     *
     * ⚠️ **A warehouse is NOT `Product.zone`.** `zone` is a free-text shelf label
     * scoped to one product row with no entity behind it; it cannot hold a
     * balance, cannot receive a transfer and is not addressable. A consumer that
     * treats the two as interchangeable will attribute stock to a string.
     *
     * ⚠️ **Publishing this entity does not make the platform multi-location.**
     * `Product.stock` remains a single store-wide scalar, and the shipped income
     * and sale ledgers are store-wide with no location on them. Until a writer
     * populates `InventoryLevel`, the sum of a store's levels is not `Product.stock`
     * and is very often zero. A consumer must not present a per-warehouse figure
     * it cannot yet compute, and must not read an empty level set as "no stock".
     */
    interface Warehouse {
        storeId: string;
        /** Server-minted identity — the only stable key. `code` is not. */
        warehouseId: string;
        /** Operator-facing name ("Depósito Central"). Prose; nothing derives from it. */
        name: string;
        /**
         * Short operator-typed code ("DEP01") used on labels, pickers and printed
         * documents.
         *
         * ⚠️ Operator-facing, never a key. Nothing guarantees it is unique inside a
         * store, nothing validates its charset, and an operator may re-type it at
         * any time. Matching a transfer or a movement on `code` instead of
         * `warehouseId` addresses whichever location happens to carry the string
         * today.
         */
        code?: string;
        /** Street address as prose. Deliberately unstructured — a warehouse is not billed to and not geocoded. */
        address?: string;
        /**
         * The location an allocator falls back to, and the one a single-location
         * store implicitly uses.
         *
         * ⚠️ Nothing in this contract enforces that exactly one warehouse per store
         * carries it. Zero primaries and two primaries are both representable, and
         * both are states a writer must refuse rather than a reader must survive —
         * a picker that assumes "the primary" will silently take whichever row it
         * read first.
         */
        isPrimary: boolean;
        /**
         * Whether the location is in service.
         *
         * ⚠️ **This is the INVERSE of the package-wide `disabled` flag** every other
         * entity here soft-deletes with, and the inversion is the trap: absence of
         * `disabled` means "live", whereas absence of `isActive` would mean "dead".
         * It is REQUIRED for exactly that reason — an optional inverted flag defaults
         * every warehouse to out-of-service. A warehouse must never carry both
         * fields; if one is ever added, the other is the one that gets removed.
         *
         * ⚠️ Deactivating does NOT move stock. Levels, holds and ledger rows against
         * the location survive it untouched, which is the point: a closed depósito
         * still has to answer what was in it.
         */
        isActive: boolean;
        /**
         * Operator-defined display and allocation order, ascending.
         *
         * Meaningful to `AllocationStrategy` member `sort_order`, which walks
         * locations in this sequence. ⚠️ Not unique and not dense — operators
         * renumber by hand, so ties and gaps are normal and a reader must not derive
         * identity or count from it.
         */
        sortOrder: number;
        /**
         * The ARCA punto de venta comprobantes issued from this location are
         * emitted against, when the location has its own.
         *
         * ⚠️ Absent means "bills under the store's own `afip.pointOfSale`", never
         * "not yet configured". Most stores will never set it — a dedicated PdV is
         * an ARCA registration, not a preference — so a UI that presents it as a
         * required field for a new warehouse is asking for a number that does not
         * exist.
         */
        pointOfSale?: number;
        /** Unix ms the warehouse row was created. */
        createdAt: number;
        /** Unix ms of the last write to the warehouse row. */
        updatedAt: number;
        /** Lowercase '#'-joined write-side index. Internal; not part of the read contract. */
        search?: string;
    }
    /**
     * The current-balance PROJECTION for one product in one warehouse
     * (`PK=WH#<warehouseId>`, `SK=PRODUCT#<productId>`).
     *
     * ⚠️ **A projection, never the authority.** The authority is the movement
     * ledger; this row exists so a picker, a storefront and an oversell guard can
     * read a balance without walking it. When the two disagree the ledger is
     * right, and the repair is to recompute this row — never to write a movement
     * that makes the ledger agree with the projection.
     *
     * ⚠️ **`onHand` has NO FLOOR and is allowed to go negative.** A marketplace
     * sale is reported to this platform AFTER it has irreversibly happened on the
     * channel's side, so refusing the decrement cannot un-sell the units — it can
     * only discard the record and leave the counter overstated, which is strictly
     * worse than an honest negative. A consumer that clamps at zero, or that
     * treats a negative as corrupt data, is hiding a real oversell. Render it.
     */
    interface InventoryLevel {
        storeId: string;
        warehouseId: string;
        productId: string;
        /**
         * Units physically present at this location. May be negative — see the
         * interface note; there is no floor.
         */
        onHand: number;
        /**
         * Units at this location spoken for but not yet shipped.
         *
         * ⚠️ **A ROLLUP of the `ReservationItem` rows in this partition, not a bare
         * counter.** Incrementing it without writing the matching hold row destroys
         * the only thing that can ever release it: nothing records who holds the
         * units, so nothing can expire them, and the stock is stranded until an
         * operator adjusts by hand. Every increment owes a `ReservationItem`, and
         * every decrement owes that item a terminal status.
         */
        reserved: number;
        /**
         * `onHand − reserved` — units a new order may actually take.
         *
         * ⚠️ **DERIVED BY DEFINITION. It is never independently authored, and no
         * writer may set it to anything other than the difference of the two fields
         * above as they stand in the SAME write.** A copy that is recomputed on its
         * own schedule, refreshed by a background job, or updated by a writer that
         * touched only one of its inputs is wrong from that moment on, silently and
         * permanently — nothing in this contract or in DynamoDB can detect it, and
         * an oversell guard reading a stale value cheerfully approves a sale of
         * stock that is not there.
         *
         * ⚠️ **Why it is on the row at all**, rather than computed at read time: a
         * DynamoDB `ConditionExpression` cannot perform arithmetic, so
         * `onHand - reserved >= :qty` is not expressible and a conditional-write
         * oversell guard has nothing to condition on. The field is materialised for
         * that guard and for nothing else. That is also exactly why the rule above
         * is absolute: the guard's soundness is the field's only justification, and
         * an out-of-band writer removes it.
         *
         * ⚠️ It may be negative whenever `onHand` is — see the interface note.
         */
        available: number;
        /**
         * Moving weighted-average cost per unit AT THIS LOCATION, in the store's
         * currency.
         *
         * ⚠️ **Per-warehouse on purpose — it must never be hoisted onto `Product`.**
         * A single store-wide average is wrong the moment a second location exists,
         * which is the exact scenario averaging is introduced for: goods bought at
         * different prices land in different places, and an outflow is valued by
         * where it left from. `Product.cost` already occupies the store-wide slot
         * with a DIFFERENT meaning — the last purchase price, overwritten by every
         * receipt — so parking an average there would silently reprice the
         * catalogue against a basis no operator quoted.
         *
         * ⚠️ Absent means "no receipt has been averaged into this location yet",
         * never "free". A valuation reader falls back to the movement row's own
         * `unitCost`, and failing that to `Product.cost`; it must not treat absence
         * as zero cost, which would report the entire balance as pure margin.
         *
         * ⚠️ Meaningful only under the `wac` valuation method. Under `fifo` the
         * answer is `costLayers`, and this field — if a writer maintains it at all —
         * is an approximation that will not reconcile to the layers.
         */
        avgCost?: number;
        /**
         * Unconsumed FIFO cost layers at this location, oldest first.
         *
         * ⚠️ Present only under the `fifo` valuation method, and optional even then:
         * layers can only be built forward from the movements that carry cost, so a
         * location that has been trading since before layering existed has none. An
         * empty or absent array is "not layered", never "nothing on hand" — reading
         * a balance from it will report zero for real stock.
         *
         * ⚠️ The layer quantities are expected to sum to `onHand` and nothing
         * enforces it. They diverge the first time an outflow is written without
         * consuming a layer, and the divergence is invisible until someone totals
         * both. Treat a mismatch as un-layered movements, not as data loss.
         */
        costLayers?: InventoryCostLayer[];
        /**
         * The earliest `expiryDate` (`YYYYMMDD`) among the lots contributing to this
         * balance — a denormalised alarm value so an expiry sweep does not walk
         * every lot of every product.
         *
         * ⚠️ A HINT, not an authority, and it decays: it is only as fresh as the
         * last writer that recomputed it, and consuming the earliest lot does not
         * update it by itself. Absent means "no lot-tracked stock here, or nothing
         * has computed it" — never "nothing expires". Always confirm against the
         * lots before acting on it.
         */
        expiryEarliest?: number;
        /**
         * Optimistic-concurrency counter, incremented on every write to this row.
         *
         * ⚠️ It guards the row against a lost update; it does NOT make the balance
         * correct. A writer that reads, computes and writes under a matching
         * `version` can still be moving `onHand` without the movement row that
         * justifies it. The version protects the arithmetic, the ledger protects the
         * meaning.
         */
        version: number;
        /** Unix ms of the last write to this row. */
        updatedAt: number;
    }
    /**
     * One unconsumed FIFO purchase layer.
     *
     * ⚠️ Named for its container rather than as a bare `CostLayer` deliberately:
     * these interfaces are AMBIENT GLOBALS with no import, so a short generic name
     * here occupies that identifier in every consumer program and collides with
     * the first unrelated costing type anyone declares.
     */
    interface InventoryCostLayer {
        /** Units REMAINING in this layer, already net of what has been consumed from it. */
        quantity: number;
        /** Per-unit cost the layer was received at. Immutable once written. */
        unitCost: number;
        /** Unix ms the layer was received — the FIFO ordering key. */
        receivedAt: number;
        /** The batch this layer came in as, when the product is lot-tracked. */
        lotId?: string;
    }
    /**
     * What a movement did to stock.
     *
     * - `receipt` — goods arrived from a supplier. Increases `onHand`.
     * - `sale` — goods left against an order. Decreases `onHand`.
     * - `transfer_out` / `transfer_in` — the two halves of a move between
     *   locations. Each is a full movement in its own partition; the pair is
     *   joined by `referenceId`.
     * - `adjustment` — an operator corrected the balance by hand. Signed either
     *   way, and the ONLY type that carries a `reason`.
     * - `return` — a customer gave goods back. Increases `onHand`.
     * - `write_off` — stock destroyed, expired or otherwise removed with no sale.
     *   Decreases `onHand`.
     * - `reservation` / `release` — a hold was placed or lifted.
     *
     * ⚠️ **`reservation` and `release` do NOT touch `onHand`.** They move
     * `reserved`, and the units are still physically present the whole time. This
     * is the single most dangerous thing about the tuple: a reader that computes a
     * balance as `Σ quantity` over a product's partition — the obvious
     * implementation, and the one the shipped store-wide ledger invites — will
     * deduct every hold from stock that never left, then deduct the sale again
     * when the hold converts. On-hand is `Σ quantity` over rows whose type is
     * NEITHER of these two.
     *
     * Adding a member is a patch bump and is safe: writers gain a value and
     * readers that switch exhaustively fail to compile until they handle it.
     * REMOVING one is not — rows carrying it are permanent and this platform never
     * backfills.
     */
    type StockMovementType = 'receipt' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'return' | 'reservation' | 'release' | 'write_off';
    /**
     * Why an operator adjusted or wrote off stock. Set only on `adjustment` and
     * `write_off` movements; a `sale` or a `receipt` has a reference, not a
     * reason.
     *
     * The set is CLOSED on purpose. A free-text reason cannot be aggregated, so a
     * store could never answer "how much did we lose to breakage last quarter" —
     * which is the entire point of auditing adjustments rather than just applying
     * them. The free-text half sits BESIDE the category in `note`.
     *
     * ⚠️ **Two members are the same concept as the shipped store-wide
     * `StockAdjustmentReason` under a different spelling, and a migration owes the
     * mapping explicitly:** `shrinkage` is `shrinkage`, `damage` is that union's
     * `breakage`, and `count_correction` is `count_correction` in both. That
     * union's `found` has no member here because direction is carried by the sign
     * of `quantity` rather than by the reason, so a positive `count_correction`
     * expresses it. `expiry`, `theft`, `admin_error` and `other` are new and have
     * no counterpart to map back to.
     *
     * ⚠️ `count_correction` is NOT in the source specification for this ledger and
     * is included because the count-session entity emits adjustment rows on
     * finalise: without it, the platform's most common adjustment is the one
     * reason that cannot be stated, and every variance would land as `other`.
     */
    type StockMovementReason = 'count_correction' | 'shrinkage' | 'damage' | 'expiry' | 'theft' | 'admin_error' | 'other';
    /** What document a movement was written against. Pairs with `referenceId`. */
    type StockMovementReferenceType = 'order' | 'purchase' | 'return' | 'service_order' | 'transfer' | 'cycle_count';
    /**
     * One immutable row of the per-warehouse stock ledger
     * (`PK=WH#<warehouseId>#PRODUCT#<productId>`).
     *
     * ⚠️ **This is a SECOND stock ledger. The platform already ships one** — the
     * store-wide `INCOME#` / `SALE#` partitions behind `StockIncome` / `StockSale`,
     * where on-hand is `Σ INCOME − Σ SALE`, quantities are unsigned and the sign
     * comes from the partition. This ledger is per-LOCATION, single-partition and
     * signed, and the two do not agree on any of those three things. It is
     * specified to SUPERSEDE the older pair by migration, not to run beside it: a
     * writer that emits into both produces a store whose two on-hand figures
     * disagree by construction, and neither can be shown to be the wrong one.
     * Until the migration lands, a location-aware writer owes exactly one of them,
     * and which one is a decision, not a preference.
     *
     * ⚠️ **Immutable. A row is never updated and never deleted.** A movement that
     * was wrong is corrected by a compensating movement, which is what makes the
     * partition auditable at all. `disabled` is deliberately absent: a soft-delete
     * flag here would mean every reader has to filter, and the one that forgets
     * silently reports stock that was retracted.
     *
     * ### The sort key
     *
     * `MOV#<paddedTs>#<uniq>`, where `paddedTs` is
     * `String(createdAt).padStart(MOVEMENT_SORT_KEY_TIMESTAMP_WIDTH, '0')` and
     * `uniq` is `movementId`.
     *
     * ⚠️ **Padded epoch milliseconds, NOT an ISO string.** Both sort correctly;
     * padded epoch is what the two shipped time-ordered ledgers on this platform
     * already use, and a third spelling would mean three key formats for one
     * concept. An UNPADDED epoch is the actual bug being guarded against — it
     * sorts lexicographically, so it interleaves the moment the digit count
     * changes.
     *
     * ⚠️ **`uniq` is a UUID, and it breaks ties — it does NOT order them.**
     * Ordering comes entirely from the padded timestamp, so the suffix only has to
     * be collision-free. A sortable-id scheme was considered and rejected: nothing
     * on this platform uses one, and adding a dependency to order rows that the
     * timestamp already orders buys nothing.
     *
     * ⚠️ **The consequence, stated so nobody infers a precision this key lacks:
     * two movements written in the SAME millisecond have NO defined relative
     * order.** They sort by UUID, which is arbitrary. For a running-balance replay
     * that is a real limitation — within one millisecond, the balance after each
     * row is not reproducible. Nothing here provides intra-millisecond
     * monotonicity, and a future caller that needs it is asking for a key-format
     * change, not making an assumption that already holds.
     */
    interface StockMovement {
        storeId: string;
        warehouseId: string;
        productId: string;
        /**
         * Server-minted UUID — the `uniq` component of the sort key and the row's
         * only identity.
         *
         * ⚠️ It carries no time information and imposes no order. A row is addressed
         * by the PAIR (`createdAt`, `movementId`); this field alone cannot rebuild
         * the sort key.
         */
        movementId: string;
        type: StockMovementType;
        /**
         * Set only on `adjustment` and `write_off`. ⚠️ Absence on those types means
         * the writer did not categorise the movement — it is the row that makes
         * "how much did we lose to breakage" unanswerable, not a normal state to
         * design for.
         */
        reason?: StockMovementReason;
        /**
         * Units moved, SIGNED — positive adds to the balance, negative removes from
         * it.
         *
         * ⚠️ **The opposite convention to the shipped store-wide ledger**, where
         * quantities are always positive and the partition supplies the sign. A
         * migration that copies quantities across without applying the sign inverts
         * every outflow, and the result still totals to a plausible-looking number.
         *
         * ⚠️ On `reservation` / `release` this is a change to `reserved`, not to
         * `onHand`. See `StockMovementType`.
         */
        quantity: number;
        /**
         * Per-unit valuation this movement was booked at.
         *
         * ⚠️ Absent means the row was never valued, which is every row a writer that
         * does no valuation produces. A reader falls back to the level's `avgCost`
         * and then to `Product.cost`; it must not infer that the cost was zero.
         */
        unitCost?: number;
        /**
         * The signed change this movement made to the location's total inventory
         * VALUE.
         *
         * ⚠️ It exists so weighted-average and FIFO valuation are a PROJECTION of
         * the ledger rather than a re-derivation of it. Recomputing value as
         * `quantity * unitCost` at read time re-splits FIFO layers that were already
         * split at write time and silently produces a different number than the one
         * the write committed to.
         *
         * ⚠️ NOT constrained to equal `quantity * unitCost`, and the cases where it
         * differs are the reason to store it: a FIFO outflow straddling layers at
         * different prices, or a landed-cost allocation arriving after the receipt.
         * A reader that "corrects" a divergence is discarding the accurate figure in
         * favour of the approximation.
         */
        valuationDelta?: number;
        /**
         * Which costing method produced `unitCost` / `valuationDelta`. Present only
         * alongside them.
         *
         * ⚠️ Stamped on the ROW on purpose — never read the store's current setting
         * to interpret a historical movement. An operator who switches methods is
         * deciding how the NEXT movement is valued; applying today's setting to rows
         * valued under the old one silently restates closed periods.
         */
        valuationMethod?: ValuationMethod;
        /** The batch these units moved as, on a lot-tracked product. */
        lotId?: string;
        /**
         * The document this movement was written against, and its id. Both present
         * or both absent.
         *
         * ⚠️ Absence is a normal, permanent state — an opening balance, an ad-hoc
         * count correction, a bag of goods that arrived with no paperwork. Never
         * treat it as a broken link or a migration gap.
         *
         * ⚠️ On a `transfer_in` / `transfer_out` pair, `referenceId` is the transfer
         * id and is the ONLY thing joining the two halves. A transfer whose halves
         * carry different reference ids is two unrelated adjustments that happen to
         * cancel out.
         */
        referenceType?: StockMovementReferenceType;
        /** Id of the document named by `referenceType`. */
        referenceId?: string;
        /** The operator who caused the movement. */
        userId: string;
        /**
         * The operator who authorised it, when authorisation was required.
         *
         * ⚠️ Absent means "no approval was required or none was recorded" — it does
         * NOT mean the movement was unapproved. Nothing in this contract enforces an
         * approval, so a report that counts absences as policy violations will
         * count every ordinary sale.
         */
        approvedBy?: string;
        /** Unix ms the movement was RECORDED — the ordering component of the sort key. */
        createdAt: number;
        /**
         * The `YYYYMMDD` day the movement physically happened.
         *
         * ⚠️ On a back-dated entry this differs from `createdAt`, and the two answer
         * different questions: a stock report asks for this one, an audit asks for
         * the other. ⚠️ It does NOT participate in the sort key, so back-dating
         * changes what a report says without changing where the row sits in the
         * ledger — which is the property that keeps the ledger append-only.
         */
        dated?: number;
        /**
         * Operator's free-text note.
         *
         * ⚠️ NEVER put personal data in it. It is operator-authored, is not scrubbed
         * by anything, and rides an append-only partition with no TTL.
         */
        note?: string;
    }
    /**
     * What happened to an individual hold.
     *
     * - `active` — the units are held and are deducted from `available`.
     * - `consumed` — the held units SHIPPED. The hold ended by becoming a sale.
     * - `released` — the hold was lifted deliberately and the units went back to
     *   `available`.
     * - `expired` — the hold aged out past `expiresAt` and the units went back.
     *
     * ⚠️ **`consumed` and `released` are not interchangeable, and conflating them
     * double-returns stock.** Consuming a hold pairs a `-reserved` with a
     * `-onHand`: the units left the building. Releasing pairs a `-reserved` with
     * NO change to `onHand`: the units are still on the shelf. A path that
     * releases a hold it has already consumed hands the same units back to
     * `available` a second time, and the store then oversells by exactly the
     * quantity of every shipped order.
     *
     * ⚠️ All three terminal members are terminal. A hold is never reopened — a new
     * hold is a new row, because the audit question is "what was held, when, by
     * what, and how did it end".
     */
    type ReservationStatus = 'active' | 'released' | 'expired' | 'consumed';
    /**
     * One individual hold on stock at one location
     * (`PK=WH#<warehouseId>#PRODUCT#<productId>`, `SK=RES#<orderLineId>`).
     *
     * ⚠️ **This entity is what makes `InventoryLevel.reserved` a rollup instead of
     * a bare counter, and that is its whole reason for existing.** A counter can
     * be incremented but never safely decremented: nothing records which order
     * holds which units, so an expiry sweep cannot know what to release, a
     * cancelled order cannot prove what it was holding, and an operator staring at
     * stranded stock has no way to find out who is holding it. Every movement of
     * `reserved` owes a row here.
     *
     * ⚠️ **The sort key is the ORDER LINE, not the order.** One order legitimately
     * holds the same product on several lines, and a hold keyed on the order alone
     * would collapse them — releasing one line would release all of them. This
     * mirrors how returns and purchase-order receipts address lines.
     */
    interface ReservationItem {
        storeId: string;
        warehouseId: string;
        productId: string;
        /**
         * The order line this hold is for — the `SK` component and the hold's
         * identity.
         *
         * ⚠️ It is the identity, so a writer that re-holds the same line OVERWRITES
         * the previous hold rather than adding to it. That is intended — a line
         * holds one quantity — but it means a re-hold silently discards the earlier
         * row's status and history.
         */
        orderLineId: string;
        /** Units held. ⚠️ Always POSITIVE — the direction is carried by `status`, not by the sign. */
        quantity: number;
        status: ReservationStatus;
        /**
         * Unix ms after which the hold is stale and its units should return to
         * `available`.
         *
         * ⚠️ **A deadline, not a mechanism. Nothing in this contract expires
         * anything.** The status does not change by itself when the clock passes,
         * so a reader that trusts `status === 'active'` will keep holding units for
         * a cart abandoned months ago unless a sweeper actually runs. A consumer
         * computing availability defensively should treat a past `expiresAt` on an
         * `active` row as already released.
         *
         * ⚠️ Absent means the hold does not expire — a confirmed order awaiting
         * dispatch, not an oversight.
         */
        expiresAt?: number;
        /** Unix ms the hold was placed. */
        createdAt: number;
        /** Unix ms the hold reached its terminal status. Absent while `active`. */
        resolvedAt?: number;
    }
    /**
     * Every state a transfer between locations can hold.
     *
     * - `draft` — being composed; nothing has left anywhere.
     * - `in_transit` — the `transfer_out` movements are written and the goods are
     *   between locations, counted at NEITHER end.
     * - `partially_received` — at least one line landed and the operator has not
     *   closed the transfer.
     * - `received` — the operator CLOSED it.
     * - `cancelled` — abandoned.
     *
     * ⚠️ **`in_transit` is a real state in which the units exist and are on no
     * shelf.** They have left the origin's `onHand` and have not joined the
     * destination's. A store-wide total that sums `InventoryLevel.onHand` across
     * locations is therefore SHORT by everything in transit, and that is correct
     * rather than a bug — but a consumer that reconciles it against
     * `Product.stock` must account for it or it will report phantom shrinkage on
     * every transfer.
     *
     * ⚠️ **`received` does NOT mean the received quantities equal the sent
     * quantities.** A short arrival the operator accepts as final closes the
     * transfer, and the difference is a real loss that needs its own adjustment —
     * closing does not write one.
     *
     * ⚠️ **`cancelled` reverses nothing.** Movements already ledgered stay
     * ledgered; the ledger is append-only and this status has no power over it.
     * Cancelling a partially received transfer means "expect no more", never
     * "un-move what moved".
     */
    type StockTransferStatus = 'draft' | 'in_transit' | 'partially_received' | 'received' | 'cancelled';
    /**
     * A movement of goods from one of a store's locations to another.
     *
     * ⚠️ **The transfer document carries no stock — the movement rows do.**
     * Creating, sending or closing one moves nothing by itself: stock changes only
     * when a `transfer_out` and later a `transfer_in` movement are written
     * carrying this `transferId` as their `referenceId`. Keeping the document and
     * the ledger separate is what allows a partial arrival, and an in-transit
     * state, to be expressible at all.
     *
     * ⚠️ **Origin and destination are never validated against each other here.** A
     * transfer to the location it came from is representable and would write two
     * cancelling movements; so is a transfer between two warehouses of different
     * stores. Both are writer refusals, not reader concerns.
     */
    interface StockTransfer {
        storeId: string;
        /** Server-minted identity. Written onto both halves' movement rows as `referenceId`. */
        transferId: string;
        fromWarehouseId: string;
        toWarehouseId: string;
        status: StockTransferStatus;
        items: TransferItem[];
        /** Unix ms the transfer was created. */
        createdAt: number;
        /** Unix ms of the last write to the transfer row. */
        updatedAt: number;
        /** The operator who raised it. */
        userId: string;
        /** Unix ms the goods left the origin — when the `transfer_out` movements were written. */
        shippedAt?: number;
        /** Unix ms the operator CLOSED the transfer. ⚠️ Not when the last line arrived. */
        receivedAt?: number;
        /** Operator note. ⚠️ Never personal data — this row is not scrubbed and has no TTL. */
        notes?: string;
        /** Lowercase '#'-joined write-side index. Internal; not part of the read contract. */
        search?: string;
        /** Soft delete. ⚠️ Movements written by the transfer survive it — they are real moves. */
        disabled?: boolean;
    }
    /**
     * One line of a transfer.
     *
     * ⚠️ **Lines are addressed by ARRAY INDEX, never by `productId`.** One
     * transfer legitimately carries the same product on several lines — two lots,
     * two conditions — and an arrival attributed by productId would collapse them
     * and credit the wrong line. This mirrors how purchase-order receipts and
     * returns address lines.
     */
    interface TransferItem {
        productId: string;
        /** Name DENORMALIZED at write time; the transfer records what was sent, under the name it had then. */
        name?: string;
        sku?: string;
        /** Units DESPATCHED from the origin. */
        quantity: number;
        /**
         * Units actually RECEIVED at the destination so far.
         *
         * ⚠️ A PROJECTION, not the authority. The authority is the set of
         * `transfer_in` movements carrying this transfer's id and this line's index;
         * this field exists so the transfer renders without a ledger walk. When the
         * two disagree, the ledger is right.
         *
         * ⚠️ Absent means nothing has arrived. A value BELOW `quantity` on a closed
         * transfer is stock that left and never landed — a real loss that needs its
         * own adjustment movement, which closing the transfer does not write.
         */
        receivedQuantity?: number;
        /** The batch these units moved as, on a lot-tracked product. */
        lotId?: string;
    }
    /**
     * How a multi-location store chooses which warehouse fills a line.
     *
     * - `manual` — the operator picks; nothing is chosen automatically.
     * - `primary` — always the `isPrimary` location.
     * - `sort_order` — walk locations by ascending `Warehouse.sortOrder` and take
     *   the first that can fill.
     * - `most_available` — the location with the highest `InventoryLevel.available`,
     *   which minimises splitting a line across locations.
     *
     * ⚠️ **Nothing in this package carries this value and nothing reads it.** It
     * is published as the vocabulary an allocator will be configured with; there
     * is no field on any entity holding it yet, and no allocator exists. A
     * consumer must not build a settings picker that appears to change behaviour —
     * choosing a strategy today changes nothing any code path can observe.
     *
     * ⚠️ None of these members is a guarantee that a single location can fill the
     * line. Partial fulfilment across locations is a separate decision that this
     * union does not express and must not be read as answering.
     */
    type AllocationStrategy = 'manual' | 'primary' | 'sort_order' | 'most_available';
}
export {};
