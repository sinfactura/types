"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALUATION_METHODS = void 0;
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
exports.VALUATION_METHODS = [
    'wac',
    'fifo',
];
