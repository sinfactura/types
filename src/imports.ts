
declare global {

	interface ProductSale {
		pk: string; // storeId-productId
		sk: string; // income-timeStamp
		orderId: string;
		customerId: string;
		fullName: string;
		quantity: number;
		price: number;
	}

	interface ProductIncome {
		pk: string; // storeId-productId
		sk: string; // income-timeStamp
		orderId?: string; // when we put items trough a buy order
		supplierId: string;
		supplierName?: string;
		quantity: number;
		cost: number;
	}

	/**
	 * Envelope returned by the bulk CSV import endpoints — `POST /products` and
	 * `POST /customers` with `mode: 'import'`.
	 *
	 * **This is deliberately NOT `ResponseApi<T>`.** `ResponseApi` requires a
	 * `data: T` payload and an `error: string | null`; the import handlers emit
	 * NEITHER. Typing an import call as `ResponseApi<Customer[]>` makes
	 * `response.data` look readable when it is always `undefined` at runtime.
	 *
	 * **Every warning field below is ABSENT on a clean import** — never `0`,
	 * never an empty array. Test presence (`if (res.unprocessed)`); never
	 * compare against a key assumed to exist (`res.unprocessed > 0`).
	 *
	 * `status` is `true` for "imported WITH warnings" too, since rows genuinely
	 * were written and the request returned 200. Treating `status: true` as
	 * "nothing to report" hides every field here.
	 *
	 * This is the shape the PRODUCTS importer returns, and it is the whole of
	 * it — products cannot carry the two customers-only email-constraint
	 * warnings. Those live on `ImportCustomersResponse`.
	 */
	interface ImportResponse {
		status: boolean;
		message: string;
		/**
		 * Rows still unwritten after the batch writer exhausted its bounded
		 * retry. Rows that DID write are kept — an import is never rolled back —
		 * so this is a partial-failure count to re-import, not a total failure.
		 */
		unprocessed?: number;
	}

	/**
	 * One duplicate-email collision reported by the customers importer. Two
	 * paths produce these and both report identically: two rows in the SAME
	 * uploaded file claiming one email, and an uploaded row claiming an email a
	 * DIFFERENT existing customer already owns.
	 */
	interface ImportEmailConflict {
		/**
		 * The colliding email, ALREADY MASKED backend-side (`a***@g***.com`) on
		 * both the intra-file and cross-owner paths — a plaintext address never
		 * leaves the api in this field (Ley 25.326). Safe to render as-is; it
		 * needs no session-replay mask class. It is also NOT a usable address:
		 * never `mailto:` it, and never match it against a customer record.
		 */
		email: string;
		/**
		 * Who holds the claim, as `CUSTOMER#{storeId}#{customerId}` — or the
		 * literal `unknown` when the existing claim row carries no owner.
		 */
		existingOwner: string;
		/** The imported row that failed to take the claim, as `CUSTOMER#{storeId}#{customerId}`. */
		attemptedOwner: string;
	}

	/**
	 * `ImportResponse` as returned by the CUSTOMERS importer, which also
	 * reseeds the per-store unique-email constraint for every email it just
	 * wrote, and reports what that reseed found.
	 *
	 * A constraint problem NEVER rolls the import back: the rows are written,
	 * the request is 200, and these fields are how the operator learns that
	 * follow-up is needed.
	 */
	interface ImportCustomersResponse extends ImportResponse {
		/**
		 * Collisions the reseed refused to auto-resolve — the operator must pick
		 * an owner. Absent when there were none.
		 */
		emailConflicts?: ImportEmailConflict[];
		/**
		 * The reseed could not run AT ALL: it threw wholesale, so NO imported
		 * email holds a uniqueness claim and the full reseed-constraints
		 * operation has to be run.
		 *
		 * Mutually exclusive with `constraintReseedFailed` — a reseed either
		 * never happened (this field) or happened and partly failed (that one).
		 * Literal `true`, never `false`; absent means the reseed did run.
		 */
		constraintReseedRequired?: true;
		/**
		 * The reseed DID run, but this many individual claims errored while the
		 * rest succeeded — a partial failure, so only those customers lack a
		 * uniqueness claim.
		 *
		 * Mutually exclusive with `constraintReseedRequired`. Absent, never `0`,
		 * when every claim was processed.
		 */
		constraintReseedFailed?: number;
	}

}
export {}; // NOSONAR