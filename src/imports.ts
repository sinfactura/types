
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

	/** Why the customers importer refused a row BEFORE writing it. */
	type ImportSkipReason =
		/** The address already belongs to a live customer in this store. */
		| 'EMAIL_TAKEN'
		/** An earlier row of the SAME uploaded file already claimed the address. */
		| 'DUPLICATE_IN_FILE'
		/**
		 * The incumbent row's state could not be read, so whether it is
		 * soft-deleted is unknown. Refused fail-closed — re-uploading the row is
		 * the fix, and unlike the other two reasons it needs no data change.
		 */
		| 'EMAIL_CHECK_INCOMPLETE';

	/**
	 * One row the customers importer refused on email uniqueness. Unlike
	 * `ImportEmailConflict` (which reports a claim the reseed found AFTER the
	 * write), these rows were never written at all.
	 */
	interface ImportSkippedRow {
		/** 0-based index in the submitted array, so the operator can find the line. */
		row: number;
		/**
		 * The colliding email, ALREADY MASKED backend-side (`a***@g***.com`) —
		 * a plaintext address never leaves the api here (Ley 25.326). Safe to
		 * render as-is; never `mailto:` it and never match it against a record.
		 */
		email: string;
		reason: ImportSkipReason;
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
		 * How many rows were refused on email uniqueness BEFORE the write, so
		 * these customers are absent from the store entirely. Absent, never `0`,
		 * when every row was written.
		 */
		skipped?: number;
		/**
		 * A BOUNDED sample of the refused rows (currently up to 200) for display.
		 * When `skipped` exceeds the cap this array is shorter than the count —
		 * never treat `skippedRows.length` as the number of refused rows, and
		 * never use it to decide what to re-upload. `skippedRowIndexes` is the
		 * complete record.
		 */
		skippedRows?: ImportSkippedRow[];
		/**
		 * EVERY refused row's 0-based index, ascending and uncapped — the
		 * complete list of lines to fix and re-upload. Present whenever `skipped`
		 * is, and always `skipped` entries long.
		 */
		skippedRowIndexes?: number[];
		/**
		 * NO imported email holds a uniqueness claim: the reseed either could not
		 * run at all or reserved nothing, so the full reseed-constraints
		 * operation has to be run.
		 *
		 * Mutually exclusive with `constraintReseedFailed` — the reseed either
		 * claimed nothing (this field) or claimed some and failed the rest (that
		 * one). Literal `true`, never `false`; absent means claims were reserved.
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