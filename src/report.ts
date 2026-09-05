
declare global {

	/**
	 * `GET /reports?mode=sales&date=YYYYMM` response row — one entry per day.
	 *
	 * Revenue is attributed by DELIVERY date, returns by their OWN `dated` — the two
	 * don't net to zero within a single row, by design. `returns`/`returnCost`/
	 * `returnCount` are POSITIVE magnitudes; netting is expressed by `net`/`netCost`.
	 */
	interface ReportSales {
		/** `YYYYMMDD` as a number, matching the API wire type. */
		date: number;
		/** Count of delivered orders on this date. */
		quantity: number;
		/** GROSS COGS of those delivered orders. */
		cost: number;
		/** GROSS revenue of those delivered orders (post-order-discount). */
		total: number;
		/**
		 * Positive sum of credited return totals dated this day.
		 * ⚠️ OPTIONAL, not forward-only any more: `GET /reports?mode=sales` now
		 * emits the return/net quintet. They stay optional because a day with no
		 * returns omits them rather than sending zeros — absent means "no returns
		 * dated this day", which is not the same as a measured zero.
		 */
		returns?: number;
		/** Count of returns dated this day. Forward-only — see `returns`. */
		returnCount?: number;
		/** Positive cost of the returned units. Forward-only — see `returns`. */
		returnCost?: number;
		/** `total - returns`. Forward-only — see `returns`. */
		net?: number;
		/** `cost - returnCost`. Forward-only — see `returns`. */
		netCost?: number;
	}

	/**
	 * One currency's slice of a `GET /reports?mode=sales` RANGE.
	 *
	 * Sits beside `data` in the response, never inside a `ReportSales` row:
	 * `{ message, data, byCurrency, mixedCurrency, truncated? }`. The per-day rows
	 * remain unchanged and remain BLENDED across currencies — a client rendering a
	 * mixed range must show these range totals and SUPPRESS the day rows, because a
	 * blended day figure is a wrong number rather than an imprecise one.
	 *
	 * ⚠️ Deliberately carries no `net`, `returns`, `returnCount`, `returnCost` or
	 * `quantity`. `Return` has no currency of its own, and joining each return to
	 * its order to infer one was rejected as too costly for this endpoint — so those
	 * figures CANNOT be split per currency at all. They are absent rather than zero
	 * because a zero here would assert a measurement nobody took.
	 */
	interface ReportSalesCurrency {
		/** The catalog currency id these figures are denominated in. */
		currency: string;
		/** GROSS revenue of delivered orders in this currency. */
		total: number;
		/** GROSS COGS of those orders. */
		cost: number;
	}

	/**
	 * One FAC/NC/net bucket of the ventas IVA summary. Every amount is a POSITIVE
	 * magnitude, including `credit` — netting is expressed by the `net` bucket only.
	 */
	interface ReportInvoicesAmounts {
		/** Voucher count in this bucket. */
		quantity: number;
		/** Neto gravado summed over every declared alícuota. */
		neto: number;
		/** Débito fiscal (IVA) summed over every declared alícuota. */
		iva: number;
		/** `ImpTotal` sum. */
		total: number;
	}

	/**
	 * One day of the `GET /reports?mode=invoices&date=YYYYMM` ventas summary.
	 *
	 * Covers only AUTHORIZED (deliverable) vouchers — `pending_cae` and
	 * `rejected` are excluded upstream, and legacy rows with no `fiscalStatus`
	 * count as authorized.
	 */
	interface ReportInvoicesResume {
		/** `YYYYMMDD` as a NUMBER, matching `Invoice.dated`. */
		date: number;
		/** Count of ALL deliverable vouchers this day, credit notes included. */
		quantity: number;

		/**
		 * Legacy roll-up columns summing EVERY deliverable voucher with a POSITIVE
		 * sign (credit notes included), so `total` mixes debits and credits.
		 * Retained for wire compatibility; prefer `gross`/`credit`/`net` below.
		 */
		neto10: number;
		neto21: number;
		iva10: number;
		iva21: number;
		neto: number;
		iva: number;
		total: number;

		/** Non-credit vouchers — facturas and notas de débito. */
		gross: ReportInvoicesAmounts;
		/**
		 * Notas de crédito only, as positive magnitudes, classified via `NC_CBTE_TIPOS`.
		 * Notas de DÉBITO are deliberately NOT here — a débito increases what's owed,
		 * so it belongs in `gross`.
		 */
		credit: ReportInvoicesAmounts;
		/** `gross - credit`, field by field. The figure an operator should read. */
		net: ReportInvoicesAmounts;
	}

	/**
	 * One voucher row of the ventas summary's spreadsheet export. Mixed string/number
	 * by design — padded fiscal columns are strings, amounts are numbers.
	 */
	interface ReportInvoicesVoucherRow {
		FECHA: string;
		CBTE_TIPO: string;
		PTO_VTA: string;
		CBTE_NUMERO: number;
		RAZON_SOCIAL: string;
		CUIT: string;
		NETO: number;
		NETO10: number;
		NETO21: number;
		TOTAL: number;
	}

	/**
	 * `GET /reports?mode=invoices&date=YYYYMM` response payload. Carries BOTH the
	 * operator-facing summary (`resume`, `period`) and the ARCA REGINFO_CV_VENTAS
	 * flat files (`customers`, `reg_alicuotas`, `reg_cbte`) — the summary nets
	 * credit notes, the flat files must keep every voucher a positive magnitude.
	 */
	interface ReportInvoices {
		/** Per-day rows, ascending by `date`. */
		resume: ReportInvoicesResume[];
		/** Same FAC/NC/net split aggregated over the whole selected period. */
		period: {
			gross: ReportInvoicesAmounts;
			credit: ReportInvoicesAmounts;
			net: ReportInvoicesAmounts;
		};
		invoices: ReportInvoicesVoucherRow[];
		/** REGINFO_CV_VENTAS fixed-width padrón de clientes. */
		customers: string;
		/** REGINFO_CV_VENTAS_ALICUOTAS.TXT — one record per declared alícuota. */
		reg_alicuotas: string;
		/** REGINFO_CV_VENTAS_CBTE.TXT — one record per voucher. */
		reg_cbte: string;
	}

	/**
	 * One aging bucket on a `mode=accounts` row.
	 *
	 * ⚠️ **BOTH EDGES ARE INCLUSIVE**, in whole days — `toDays: null` means
	 * unbounded above. This is closed-closed, NOT half-open: the buckets are
	 * `[0,30]`, `[31,60]`, `[61,90]`, `[91,null]`, so the next `fromDays` is the
	 * previous `toDays` PLUS ONE. Nothing is in two buckets and nothing falls
	 * between them.
	 *
	 * ⚠️ That is only well-defined because **non-integer edges are dropped**
	 * rather than coerced. A fractional edge like `30.5` would leave a real gap
	 * between `30` and `31` and money would fall into it, so the integer filter
	 * is load-bearing for this convention — not defensive hygiene to relax later.
	 *
	 * ⚠️ Edges are **caller input**, so a `NaN` reaching the comparison is not
	 * inert: every comparison against `NaN` is false, which routes EVERY debit
	 * to the open-ended bucket and reports a whole ledger as severely overdue.
	 * Filter, never coerce.
	 */
	interface AgingBucket {
		/** Inclusive lower edge, whole days. */
		fromDays: number;
		/** INCLUSIVE upper edge, whole days. `null` = unbounded above. */
		toDays: number | null;
		amount: number;
	}

	/**
	 * Aging summary on a `GET /reports?mode=accounts` row.
	 *
	 * ⚠️ **The two failure states are independent and can co-occur** — do not
	 * collapse them into one flag. They want opposite operator actions.
	 *
	 * - `available: true` — `untracked` is debt predating the summary, i.e. the
	 *   forward-only gap. Readable as that and nothing else.
	 * - `available: false` — the customer's debit array overflowed its cap.
	 *   **`buckets` is EMPTY**, and `untracked` is an undifferentiated residual
	 *   that mixes the capped overflow with the forward-only gap. It is NOT
	 *   readable as either state alone; go to the per-customer ledger.
	 *
	 * `buckets` is empty rather than partial on purpose: a consumer that sums a
	 * partial array renders a debtor as LESS overdue than they are, and that is
	 * the direction that costs money. An empty array cannot be summed into a
	 * plausible-looking wrong answer.
	 */
	interface ReportAccountsAging {
		/** Empty when `available` is `false` — see the reading rule above. */
		buckets: AgingBucket[];
		/**
		 * `max(0, balance - sum(buckets))`, clamped so a customer in credit never
		 * reports negative arrears. Meaning depends on `available`.
		 */
		untracked: number;
		/** `false` = the debit array overflowed its cap; the summary is not usable. */
		available: boolean;
	}

	/**
	 * `GET /reports?mode=accounts` response row — one per customer with a
	 * non-zero balance, debtors first then credits, each ascending by `balance`.
	 *
	 * ⚠️ `balance` is a LIVE running balance read off the `Customer` row, not a
	 * sum over the period. `aging` is derived from the same row's denormalised
	 * open debits, so the two agree by construction — but only for debits the
	 * row actually carries. See `ReportAccountsAging.untracked`.
	 */
	interface ReportAccountsRow {
		storeId: string;
		customerId: string;
		fullName: string;
		balance?: number;
		/** Absent on a row whose aging was not computed at all. */
		aging?: ReportAccountsAging;
	}

}

export {}; // NOSONAR
