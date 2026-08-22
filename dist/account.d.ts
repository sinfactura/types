declare global {
    interface Account {
        storeId: string;
        accountId: string;
        orderId?: string;
        createdAt: number;
        dated: number;
        /**
         * NOT a plain customer id — a composite index key, in one of two shapes:
         *
         * - `` `${customerId}#${createdAt}` `` — movement rows (`CUST000107#1786112946988`)
         * - `` `BALANCE-${customerId}` ``      — carried-forward balance rows
         *
         * The listing query matches with `begins_with`, so passing a bare `CUST……`
         * as a FILTER works and conveniently excludes the `BALANCE-` rows. What does
         * not work is the obvious client-side equality test:
         *
         * ```ts
         * rows.filter((row) => row.customerId === customerId) // never matches
         * ```
         *
         * Compare on the prefix, or split on `#`. This has already cost real
         * behaviour in a consumer: one code path stripped the suffix and another did
         * not, and the one that did not returned an empty list rather than failing.
         */
        customerId?: string;
        fullName?: string;
        subject?: string;
        /**
         * Optional: the manual account-creation endpoint drops the key entirely
         * when the operator text (and any FX suffix) is empty, so persisted rows —
         * and every read built from them — may lack it. Render a fallback.
         */
        details?: string;
        debit?: number;
        credit?: number;
        amount?: number;
        /**
         * catalogId (lowercase e.g. `'ars'`) — FK to PlatformCurrency (ADR-0013).
         *
         * DENOMINATION CONTRACT: this row's money values are denominated in the
         * catalogId named here. When ABSENT (≈all legacy rows), the row is
         * denominated in `store.config.displayCurrency` as of write time — NEVER
         * infer denomination from `customer.currencyId` (a display preference,
         * not a ledger fact; mislabeling by it is the root cause of the
         * denomination bug). 6 legacy rows carry a raw uppercase ISO `'ARS'`,
         * being normalized to catalogId.
         */
        currency?: string;
        currencyValue?: number;
        /**
         * @deprecated Unix ms at which `currencyValue` was effective (ADR-0013) —
         * but NO writer stamps it on ACCOUNT rows: only the parallel Cash mirror
         * row receives it. Undefined on 100% of Account reads today; keep reading
         * `currencyValue` alone until an Account writer exists.
         */
        currencyValueAt?: number;
        balance?: number;
        userId?: string;
        deleted?: boolean;
        /**
         * Provenance of a link-derived credit row, set together ONLY when
         * POST /payments/{source}/{paymentId}/link runs with applyCredit:true.
         * Manual PAGO rows leave both undefined. FE uses these to render the
         * source chip and dedup against the matching PaymentReceived row.
         */
        paymentRefSource?: PaymentReceivedSource;
        paymentRefId?: string;
    }
}
export {};
