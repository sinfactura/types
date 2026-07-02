/**
 * Demo environment types (sinfactura/types#33, part of sinfactura/app#1054).
 *
 * Custom JWT claims minted for anonymous public demo sessions
 * (test.sinfactura.com) and in-app demo tenants. The `readOnly` flag is
 * enforced server-side via the `requireWritable` gate (ADR-0010 / api#870);
 * see also `Store.type === 'demo'` in store.ts.
 */
export {};
