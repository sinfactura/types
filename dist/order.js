/* -------------------------------------------------------------------------- */
/*  Order state model — the legal moves on each axis                          */
/* -------------------------------------------------------------------------- */
/*
 * Deliberately NOT `declare global`, unlike everything above: a transition
 * table is needed as a VALUE (to answer "is this move legal", to build the
 * `allowed` set a 409 echoes back, and to seed a request validator), so import
 * it:
 *
 * ```ts
 * import { ORDER_FULFILMENT_TRANSITIONS, ORDER_FULFILMENT_STATUSES } from 'sinfactura-types';
 * ```
 *
 * Both tables are `Record<Status, …>` over the whole union, so adding a status
 * without giving it a row is a TYPECHECK FAILURE. That is the point: a table
 * built from an array of pairs, or a `Partial<Record<…>>`, compiles clean while
 * one status silently has no legal move at all.
 *
 * These tables state which moves are LEGAL, not which guards a given writer
 * applies. A writer may be more restrictive than the table — the marketplace
 * shipment sync is, treating `delivered` as terminal for itself so a replayed
 * or out-of-order webhook can never un-deliver an order — and that stays a
 * property of the writer.
 */
/**
 * Legal moves on the fulfilment axis.
 *
 * `pending -> delivered` is legal DIRECTLY and must stay that way: the
 * marketplace shipment sync writes a delivery onto an order that was never
 * marked ready, and the derivation rule on {@link OrderFulfilmentStatus} maps
 * exactly that row to `delivered`. A table that forced delivery through `ready`
 * would 409 a webhook that describes something that already happened.
 *
 * `not_delivered` sits LATERAL to `ready`, reachable from both `pending` and
 * `ready` and leading back to either `ready` (the carrier re-attempts) or
 * `delivered` (it succeeds on the retry). It is not terminal — a failed
 * delivery attempt is a setback, not an ending — and it is not reachable from
 * `delivered`, because nothing un-delivers an order by failing to deliver it.
 *
 * `delivered -> ready` is the operator's explicit un-delivery, which exists and
 * is same-calendar-day only (it reverses a balance movement and an account row
 * that are reconciled per day). It lands on `ready` rather than `pending`
 * because un-delivery does not clear `readyAt`. There is therefore NO terminal
 * fulfilment state — `ORDER_FULFILMENT_TERMINAL_STATUSES` is empty by
 * construction, and it is derived rather than hand-listed so it can never
 * disagree with the table.
 *
 * There are no self-edges: re-requesting the current status is a no-op, not a
 * transition.
 */
export const ORDER_FULFILMENT_TRANSITIONS = {
    pending: ['ready', 'delivered', 'not_delivered'],
    ready: ['delivered', 'not_delivered'],
    not_delivered: ['ready', 'delivered'],
    delivered: ['ready'],
};
/**
 * Legal moves on the financial axis — every one of them, in both directions.
 *
 * This table is fully connected ON PURPOSE, and saying so is more honest than
 * inventing a restriction. The financial state is a DERIVED, reversible verdict
 * over the ledger: linking a payment moves it forward, unlinking or refunding
 * one moves it back, and a credit note or return can settle an order by
 * shrinking the debit rather than by paying it. No sequence of those is
 * illegal, so this table can never return an illegal move.
 *
 * It exists for the two things it still buys: the `Record` proves every status
 * has been considered, and the resolver built on it gives the financial axis
 * the same no-op detection and same compare-and-set precondition shape as the
 * fulfilment axis, so one writer pattern covers both.
 */
export const ORDER_FINANCIAL_TRANSITIONS = {
    pending: ['partial', 'paid'],
    partial: ['pending', 'paid'],
    paid: ['pending', 'partial'],
};
/*
 * The value lists are DERIVED from the tables' keys rather than written out a
 * second time. A hand-written `as const satisfies readonly Status[]` array
 * proves every member is valid but NOT that the list is complete, so a new
 * status would compile clean while a request validator built on the array
 * silently 400s it. Taking the keys of an exhaustive `Record` cannot omit one.
 *
 * The assertion to a non-empty tuple is sound for the same reason — the record
 * type has at least one key — and it is what a schema builder needs.
 */
/** Every fulfilment status, in lifecycle order. */
export const ORDER_FULFILMENT_STATUSES = Object.keys(ORDER_FULFILMENT_TRANSITIONS);
/** Every financial status, from unpaid to settled. */
export const ORDER_FINANCIAL_STATUSES = Object.keys(ORDER_FINANCIAL_TRANSITIONS);
export const isOrderFulfilmentStatus = (value) => ORDER_FULFILMENT_STATUSES.includes(value);
export const isOrderFinancialStatus = (value) => ORDER_FINANCIAL_STATUSES.includes(value);
/**
 * The fulfilment statuses nothing transitions out of — DERIVED from the table,
 * never hand-listed, so it cannot drift from it.
 *
 * Empty today, and that is the correct answer rather than an oversight:
 * operator un-delivery gives `delivered` an outgoing edge. Read it, do not
 * assume it.
 */
export const ORDER_FULFILMENT_TERMINAL_STATUSES = ORDER_FULFILMENT_STATUSES.filter((status) => ORDER_FULFILMENT_TRANSITIONS[status].length === 0);
export const isTerminalOrderFulfilmentStatus = (status) => ORDER_FULFILMENT_TRANSITIONS[status].length === 0;
