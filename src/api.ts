
declare global {

	interface ResponseApi<T = Record<string, string>> {
		status: boolean;
		error: string | null;
		message: string | null;
		data: T;
		ConsumedCapacity?: Record<string, string | number>;
		/**
		 * Either a DynamoDB key object or an opaque, already-encoded cursor
		 * string, depending on the endpoint:
		 * - **Key object** — a handler surfacing a raw page cursor from its own
		 *   `Query`. Can be a NUMBER when the query rides a GSI with a numeric
		 *   sort key (e.g. `GET /invoices`' date branch yields `dated` as a number).
		 * - **Opaque string** — a base64url cursor the caller round-trips back
		 *   unparsed as `?startKey=` (e.g. `GET /suppliers?mode=invoices`),
		 *   derived from the last RETURNED row, never a raw `LastEvaluatedKey`.
		 *
		 * Consumers must not assume this is enumerable — treat the string form
		 * as opaque and pass it straight back.
		 */
		LastEvaluatedKey?: string | Record<string, string | number>;
		/**
		 * Set by endpoints whose result was capped before the query was
		 * exhausted — rows are genuinely missing. Distinct from
		 * `LastEvaluatedKey`: an endpoint can be truncated with NO cursor to
		 * continue from. Fiscal exports never set it — they fail the request
		 * instead, since a short fiscal file must not be returned at all.
		 */
		truncated?: boolean;
	}

}

export {}; // NOSONAR