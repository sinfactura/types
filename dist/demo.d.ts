/**
 * Demo environment types (sinfactura/types#33, part of sinfactura/app#1054).
 *
 * Custom JWT claims minted for anonymous public demo sessions
 * (test.sinfactura.com) and in-app demo tenants. The `readOnly` flag is
 * enforced server-side via the `requireWritable` gate (ADR-0010 / api#870);
 * see also `Store.type === 'demo'` in store.ts.
 */
declare global {
    /**
     * Firebase custom claims attached to a demo session token. The presence of
     * `demo: true` marks the session as a demo tenant.
     */
    interface DemoClaims {
        /** Always `true` — discriminates a demo session from a real one. */
        demo: true;
        /** Tenant the demo session is scoped to. */
        storeId: string;
        /** When true, all writes are blocked (view-only demo). */
        readOnly: boolean;
    }
}
export {};
