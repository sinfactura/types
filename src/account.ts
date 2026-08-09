
declare global {

	interface Account {
		storeId: string;
		accountId: string;
		orderId?: string;
		createdAt: number; // timestamp
		dated: number; // 20220123
		customerId?: string;
		fullName?: string;
		subject?: string;
		details: string;
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
		// TODO(api#1350): narrow `currency: string` → `CatalogId` once raw-ISO rows are normalized
		currency?: string;
		currencyValue?: number;
		// Unix ms at which `currencyValue` was effective (ADR-0013).
		currencyValueAt?: number;
		balance?: number;
		// Optional: only some writers stamp `userId` (the payment-link credit and
		// return credit do; the manual POST /account row and order-delivery debit
		// — the two highest-volume writers — do not). No read path fabricates it;
		// render a fallback rather than assuming attribution.
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

export {}; // NOSONAR