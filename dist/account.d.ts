declare global {
    interface Account {
        storeId: string;
        accountId: string;
        orderId?: string;
        createdAt: number;
        dated: number;
        customerId?: string;
        fullName?: string;
        subject?: string;
        details: string;
        debit?: number;
        credit?: number;
        amount?: number;
        /**
         * catalogId (api#942, lowercase e.g. `'ars'`/`'usd-oficial'`) — FK
         * to PlatformCurrency. Promoted from the api#945 module augmentation
         * (app#1539 / ADR-0013).
         *
         * DENOMINATION CONTRACT: this row's money values (`amount`/`credit`/
         * `debit`/`balance`) are denominated in the catalogId named here.
         * When `currency` is ABSENT — which is ≈all legacy/historical rows —
         * the row is denominated in `store.config.displayCurrency` as it was
         * at write time, and consumers MUST fall back to it. NEVER infer the
         * denomination from `customer.currencyId`: that field is a
         * display/pricing preference (passenger data server-side), and
         * mislabeling unstamped rows by it is the root cause of api#1333.
         *
         * 6 legacy rows carry a raw uppercase ISO `'ARS'` (pre-#1137);
         * being normalized to catalogId in api#1350.
         */
        currency?: string;
        currencyValue?: number;
        currencyValueAt?: number;
        balance?: number;
        userId: string;
        deleted?: boolean;
        /**
         * Provenance of a link-derived credit row (api#933 / PR#943, app#1344).
         * Set together ONLY when POST /payments/{source}/{paymentId}/link runs with
         * applyCredit:true and auto-creates this Account credit row. Manual PAGO
         * rows leave both undefined. The FE reads them to render the source chip
         * and dedup against the matching PaymentReceived projection row.
         */
        paymentRefSource?: PaymentReceivedSource;
        paymentRefId?: string;
    }
}
export {};
