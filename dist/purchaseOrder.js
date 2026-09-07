/**
 * Every state a purchase order can hold, as a runtime value so the api's Zod
 * enum, the operator's filter chips and the union all derive from ONE list.
 *
 * The order of the tuple is the lifecycle order and is meaningful to a UI that
 * renders a progress rail; it is NOT an ordering the server may compare on.
 * `cancelled` is terminal and reachable from anywhere before `received`, so a
 * numeric "later than" derived from this index is wrong for that member.
 */
export const PURCHASE_ORDER_STATUSES = [
    'draft',
    'sent',
    'partially_received',
    'received',
    'cancelled',
];
