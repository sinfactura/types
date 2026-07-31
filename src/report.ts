
declare global {

	/**
	 * `GET /reports?mode=sales&date=YYYYMM` response row — one entry per day
	 * (api#549 / types#111).
	 *
	 * Revenue is attributed by DELIVERY date and returns by their OWN `dated`, so
	 * a return of a January order processed in February lands in February. The
	 * two therefore do not net to zero within a single row, by design.
	 *
	 * ⚠️ `returns`, `returnCost`, and `returnCount` are POSITIVE magnitudes — the
	 * netting is expressed by `net`/`netCost`, not by a sign on the return
	 * fields. This mirrors the fiscal convention elsewhere in the platform, where
	 * credit-note rows also stay positive and the voucher type carries the sign.
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
		/** Positive sum of credited return totals dated this day. */
		returns: number;
		/** Count of returns dated this day. */
		returnCount: number;
		/** Positive cost of the returned units. */
		returnCost: number;
		/** `total - returns`. */
		net: number;
		/** `cost - returnCost`. */
		netCost: number;
	}

}

export {}; // NOSONAR
