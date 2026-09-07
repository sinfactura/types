"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CYCLE_COUNT_STATUSES = void 0;
/**
 * Every state a count session can hold, as a runtime value so the api's Zod
 * enum, the operator's filter and the union all derive from ONE list.
 */
exports.CYCLE_COUNT_STATUSES = [
    'open',
    'finalized',
    'cancelled',
];
