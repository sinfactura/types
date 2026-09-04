/**
 * The costing methods a store may run its inventory under, as a runtime value
 * so the api's Zod enum, the operator's settings picker and the union below all
 * derive from ONE list instead of three copies that drift.
 *
 * LIFO is deliberately absent. Adding a third member is not a formatting change
 * — it is an accounting-policy decision with a reporting consequence for every
 * store that adopts it, so it belongs in a decision, not in a patch that widens
 * a union because a picker wanted another option.
 */
export const VALUATION_METHODS = [
  'wac',
  'fifo',
] as const satisfies readonly ValuationMethod[];

declare global {
  /**
   * How an outflow is valued when it leaves stock.
   *
   * - `wac` — weighted average cost. One running average per stock location;
   *   every receipt re-averages it, and every outflow is valued at the average
   *   as it stood when the units left.
   * - `fifo` — the oldest unconsumed inbound layer is consumed first, so a
   *   single outflow can straddle several layers bought at different prices.
   *
   * ⚠️ **Publishing this union does not mean the two methods currently produce
   * different numbers, and a consumer must not assume they do.** Today an
   * outflow row's `cost` is the product's CURRENT cost — the price of the most
   * recent receipt, which the income path writes straight onto `Product.cost` —
   * so every outflow is valued at latest-cost, which is neither method. The
   * field that lets the two diverge is `StockSaleWrite.unitCost`; until a writer
   * populates it, selecting a method changes nothing a report can see.
   *
   * ⚠️ **WAC's per-location average has no home in this package yet.** A single
   * average belongs to one stock location, and there is no published
   * `InventoryLevel` to hang it on. It must NOT be parked on `Product` as a
   * global scalar to get it shipped: `Product.cost` already occupies that slot
   * with a different meaning (last purchase price), and a second store-wide
   * average would be wrong the moment a second location exists — which is the
   * exact scenario the method is being introduced for.
   *
   * ⚠️ **The method is a property of the ROW, not of the store, at read time.**
   * An operator who switches methods does not intend to re-value the past, but
   * a report that reads today's store setting and applies it to rows valued
   * under the old one does exactly that, silently and retroactively. That is why
   * the movement row carries its own `valuationMethod` stamp; the store setting
   * is only what the NEXT row is valued under.
   */
  type ValuationMethod = 'wac' | 'fifo';
}

export {}; // NOSONAR
