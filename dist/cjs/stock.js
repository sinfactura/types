"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_STOCK_ADJUSTMENT_NOTE_BYTES = exports.STOCK_SALE_ADJUSTMENT_REASONS = exports.STOCK_INCOME_ADJUSTMENT_REASONS = exports.STOCK_ADJUSTMENT_REASONS = void 0;
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
exports.STOCK_ADJUSTMENT_REASONS = [
    "count_correction",
    "shrinkage",
    "breakage",
    "found",
];
/**
 * Reasons that can only ever INCREASE on-hand, so the only ones legal on an
 * `INCOME#` adjustment row. `shrinkage`/`breakage` are absent because stock that
 * was stolen or destroyed cannot arrive.
 */
exports.STOCK_INCOME_ADJUSTMENT_REASONS = [
    "count_correction",
    "found",
];
/**
 * Reasons that can only ever DECREASE on-hand, so the only ones legal on a
 * `SALE#` adjustment row. `found` is absent because stock that was discovered
 * cannot deplete.
 */
exports.STOCK_SALE_ADJUSTMENT_REASONS = [
    "count_correction",
    "shrinkage",
    "breakage",
];
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
exports.MAX_STOCK_ADJUSTMENT_NOTE_BYTES = 280;
