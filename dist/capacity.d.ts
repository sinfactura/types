/**
 * How many distinct PRODUCT LINES one cart or order can carry.
 *
 * ⚠️ **This is a MIRROR, not the authority.** api derives the real value in
 * `stacks/helpers/orderCapacity.ts` from knowledge this package does not and
 * should not have: each product line costs exactly 2 DynamoDB transaction
 * items (the stock `Update` and the `SALE#` `Put`), against a fixed overhead
 * of 4 (STORE stats, CUSTOMER `lastBuy`, the basket-clear `Delete`, and the
 * order row that `dynamoUpdate` prepends) inside the 100-item transaction
 * ceiling.
 *
 * Publishing the derivation's OUTPUT as a source of truth would convert an
 * expression into a hardcoded literal in the repo least able to notice when
 * it stops being right — which is exactly what `orderCapacity.ts`'s own
 * docblock exists to prevent. So consumers get a readable number here, api
 * keeps deriving it, and the two are pinned together by a unit test in api
 * asserting they agree. A true cross-repo binding is impossible; a LOUD
 * mirror is the honest substitute. Change the overhead arithmetic and that
 * test goes red, forcing a republish of this file.
 *
 * Consumers use it to bound a cart in the UI before the server refuses.
 */
export declare const MAX_ORDER_PRODUCT_LINES = 48;
