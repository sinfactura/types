/**
 * Every state a count session can hold, as a runtime value so the api's Zod
 * enum, the operator's filter and the union all derive from ONE list.
 */
export const CYCLE_COUNT_STATUSES = [
    'open',
    'finalized',
    'cancelled',
];
