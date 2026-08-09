/**
 * Demo environment types.
 *
 * Custom JWT claims minted for anonymous public demo sessions
 * (test.sinfactura.com) and in-app demo tenants. The `readOnly` flag is
 * enforced server-side via the `requireWritable` gate (ADR-0010);
 * see also `Store.type === 'demo'` in store.ts.
 */

declare global {
	/**
	 * Firebase custom claims attached to a demo session token; `demo: true`
	 * marks the session as a demo tenant.
	 */
	interface DemoClaims {
		demo: true;
		storeId: string;
		/** When true, all writes are blocked (view-only demo). */
		readOnly: boolean;
	}
}

export {}; // NOSONAR
