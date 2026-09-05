/**
 * Every movement type the warehouse ledger can record, as a runtime value so
 * the api's Zod enum, the operator's filter chips and the union all derive from
 * ONE list instead of three copies that drift.
 *
 * ⚠️ **The tuple is NOT a partition of on-hand.** `reservation` and `release`
 * move `InventoryLevel.reserved`, not `onHand`, so a naive `Σ quantity` over a
 * product's partition double-counts every hold. See `StockMovementType`.
 */
export const STOCK_MOVEMENT_TYPES = [
    'receipt',
    'sale',
    'transfer_in',
    'transfer_out',
    'adjustment',
    'return',
    'reservation',
    'release',
    'write_off',
];
/**
 * Why an operator moved stock by hand. Runtime value for the same
 * one-list-not-three reason as `STOCK_MOVEMENT_TYPES`.
 *
 * ⚠️ This is a SUPERSET of `StockAdjustmentReason` with different spellings for
 * two overlapping members — see `StockMovementReason` for the mapping a
 * migration owes.
 */
export const STOCK_MOVEMENT_REASONS = [
    'count_correction',
    'shrinkage',
    'damage',
    'expiry',
    'theft',
    'admin_error',
    'other',
];
/** Every state an individual hold can hold. Runtime value for the api's Zod enum. */
export const RESERVATION_STATUSES = [
    'active',
    'released',
    'expired',
    'consumed',
];
/**
 * Every state a stock transfer can hold, as a runtime value.
 *
 * The order of the tuple is the lifecycle order and is meaningful to a UI that
 * renders a progress rail; it is NOT an ordering the server may compare on.
 * `cancelled` is terminal and reachable from anywhere before `received`, so a
 * numeric "later than" derived from this index is wrong for that member.
 */
export const STOCK_TRANSFER_STATUSES = [
    'draft',
    'in_transit',
    'partially_received',
    'received',
    'cancelled',
];
/** How a multi-location store picks which warehouse fills a line. Runtime value for the settings picker. */
export const ALLOCATION_STRATEGIES = [
    'manual',
    'primary',
    'sort_order',
    'most_available',
];
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
export const MOVEMENT_SORT_KEY_TIMESTAMP_WIDTH = 13;
