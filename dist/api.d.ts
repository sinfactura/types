declare global {
    interface ResponseApi<T = Record<string, string>> {
        status: boolean;
        error: string | null;
        message: string | null;
        data: T;
        ConsumedCapacity?: Record<string, string | number>;
        /**
         * Either a DynamoDB key object or an opaque, already-encoded cursor string,
         * depending on the endpoint (api#1983):
         *
         * - **Key object** — a handler surfacing a raw page cursor from its own
         *   `Query` (`GET /products`, `/customers`, `/invoices`, `/users`,
         *   `/notifications`, `/logs`, the platform MP log endpoints). Key attributes
         *   are `S` or `N`, so a value can be a NUMBER whenever the query rides a
         *   GSI with a numeric sort key: `GET /invoices`' date branch (`PK-dated`)
         *   yields `{ PK, SK, dated }` with a numeric `dated`, and `GET /products`'
         *   list branch (`PK-updatedAt`) likewise. Previously typed
         *   `Record<string, string>`, which those endpoints never actually matched.
         * - **Opaque string** — a base64url cursor the caller round-trips back
         *   unparsed as `?startKey=`. `GET /suppliers?mode=invoices` and
         *   `mode=invoiceFiles` emit this: their cursor is derived from the last
         *   RETURNED row, never from a raw `LastEvaluatedKey`, which can skip rows.
         *
         * Consumers must not assume this is enumerable — treat the string form as
         * opaque and pass it straight back.
         */
        LastEvaluatedKey?: string | Record<string, string | number>;
        /**
         * Set by endpoints whose result was capped before the query was exhausted,
         * i.e. rows are genuinely missing (api#1983). Emitted today by
         * `GET /reports?mode=sales` and `mode=supplier-invoices`.
         *
         * Distinct from `LastEvaluatedKey`: an endpoint can be truncated with NO
         * cursor to continue from, so `truncated: true` is not "fetch the next page",
         * it is "this answer is incomplete". Fiscal exports never set it — they fail
         * the request instead, because a short fiscal file must not be returned at all.
         */
        truncated?: boolean;
    }
}
export {};
