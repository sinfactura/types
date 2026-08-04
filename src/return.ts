
declare global {

	interface Return {
		storeId: string;
		returnId: string;
		orderId: string;
		customerId: string;
		invoiceId?: string;
		creditNoteId?: string;

		items: ReturnItem[];

		/**
		 * GROSS sum of the selected lines, BEFORE the originating order's
		 * discount (api#547). Not what the customer is credited.
		 */
		subtotal: number;
		cost: number;
		/**
		 * The amount actually credited / credit-noted — `subtotal` after the
		 * originating order's discount multiplier (`1 - Order.discount / 100`).
		 * This is the figure that must agree with the ACCOUNT credit row and the
		 * NC total.
		 */
		total: number;

		reason: ReturnReason;
		notes?: string;
		userId: string;

		emitCreditNote: boolean;
		sendEmail: boolean;
		/**
		 * @deprecated Legacy boolean, retained for backward-compatible reads.
		 * `ncStatus` is the source of truth; this is equivalent to
		 * `ncStatus === 'authorized'`.
		 */
		creditNoteEmitted: boolean;

		/**
		 * Client-supplied idempotency key (api#547) — a UUID minted per submit
		 * attempt and persisted so a replay is traceable to the original
		 * request.
		 *
		 * ⚠️ The dedupe itself does NOT key off this field. The api's canonical
		 * `withIdempotency` helper reads the `Idempotency-Key` **HTTP header**
		 * only, and is opt-in (no header ⇒ no idempotency at all). A client MUST
		 * therefore send the same UUID BOTH as `CreateReturnRequest.requestId`
		 * and as the `Idempotency-Key` header; the body field exists so the
		 * committed RETURN row stays traceable to the request that made it.
		 * Header dedupe is scoped per user (`SK: {userId}#{key}`) with a 24h TTL.
		 *
		 * Optional because a future non-client-originated return (an automated
		 * marketplace claim, say) may carry no caller-supplied key.
		 */
		requestId?: string;

		/**
		 * Durable credit-note lifecycle (api#547). Independent of the return
		 * transaction: a committed return stays successful even when the NC is
		 * `pending` or `rejected`, and ARCA failure never rolls the return back.
		 *
		 * REQUIRED — every return records a state, `not_requested` included. It
		 * was briefly optional "for pre-api#547 rows"; none exist (the feature is
		 * unbuilt), and an absent value would be an unnamed fifth state that
		 * every consumer would have to invent a meaning for.
		 */
		ncStatus: ReturnCreditNoteStatus;
		/** Human-readable failure detail when `ncStatus === 'rejected'`. Never raw ARCA payloads. */
		ncError?: string;
		/**
		 * Machine-readable failure cause when `ncStatus === 'rejected'` (api#547).
		 * Distinct from `ncError`, which is prose: this is what a client branches
		 * on to decide whether the retry mode is worth offering.
		 */
		ncErrorCode?: ReturnCreditNoteErrorCode;

		createdAt: number;
		dated: number;
	}

	/**
	 * Credit-note state machine for a return (api#547).
	 *
	 * - `not_requested` — the operator did not ask for an NC.
	 * - `pending` — requested and genuinely in flight.
	 * - `authorized` — ARCA granted it; `creditNoteId` is stamped.
	 * - `rejected` — refused or refused-to-attempt; retryable via the
	 *   return-credit-note mode when `ncErrorCode` says so.
	 *
	 * ⚠️ A return NC is always a PARTIAL NC (it credits a subset of the order's
	 * lines), and the partial path has **no offline contingency**: when ARCA is
	 * down, `POST /invoices` fails closed with `502 PARTIAL_NC_AFIP_DOWN` before
	 * submitting, rather than degrading to a `pending_cae` invoice row
	 * (api#1749 — a pending row cannot carry the billed subset, so the drain
	 * would rebuild it as a FULL-order credit note). So an ARCA outage must land
	 * a return on `rejected` + `PARTIAL_NC_AFIP_DOWN`, never on `pending`:
	 * nothing exists for the invoice reconciliation to settle, and a `pending`
	 * there would hang forever.
	 */
	type ReturnCreditNoteStatus = 'not_requested' | 'pending' | 'authorized' | 'rejected';

	/**
	 * Why a return's credit note was refused (api#547). Every member is a real
	 * guard on the canonical partial-NC path behind `POST /invoices`.
	 *
	 * Retryable once the cause clears:
	 * - `PARTIAL_NC_AFIP_DOWN` — ARCA unreachable; no CAEA/pending fallback exists
	 *   for a partial. Retry when ARCA recovers.
	 *
	 * Terminal without operator action:
	 * - `NC_MULTI_FAC_UNSUPPORTED` — the order carries more than one distinct
	 *   domestic FAC, so the NC cannot be attributed to one voucher.
	 * - `NC_EXCEEDS_FAC_TOTAL` — the credit exceeds the FAC's remaining
	 *   allowance (FAC total − prior non-rejected NCs). Note the cap is not
	 *   clamped at zero: a fully-credited FAC refuses every further return NC.
	 * - `CBTE_ASOC_NOT_FOUND` — no factura on the order matches the resolved
	 *   `cbte_numero`.
	 * - `PARTIAL_NC_INVALID_SUBSET` — the billed subset is out of range,
	 *   over-quantity, or repeats a line index.
	 * - `PARTIAL_NC_REQUIRES_CBTE` — `partialItems` sent with no `cbte_numero`.
	 *   Server-resolved, so this indicates an api-side defect, not operator error.
	 * - `NC_EMISSION_FAILED` — anything else ARCA refused.
	 */
	type ReturnCreditNoteErrorCode =
		| 'PARTIAL_NC_AFIP_DOWN'
		| 'NC_MULTI_FAC_UNSUPPORTED'
		| 'NC_EXCEEDS_FAC_TOTAL'
		| 'CBTE_ASOC_NOT_FOUND'
		| 'PARTIAL_NC_INVALID_SUBSET'
		| 'PARTIAL_NC_REQUIRES_CBTE'
		| 'NC_EMISSION_FAILED';

	interface ReturnItem {
		/**
		 * Index of the line in the ORIGINATING `Order.items` array (api#547).
		 *
		 * Returns are identified by array index, never by `productId`: one order
		 * can carry the same product on several lines at different prices, so a
		 * productId-keyed return would collapse them and credit the wrong amount.
		 *
		 * REQUIRED — this is the line's identity, and the handler always writes
		 * it. It was briefly optional "for pre-api#547 rows", but no such rows
		 * exist or can exist: the returns feature is unbuilt, so nothing has
		 * ever written a RETURN row. An optional identity forces every reader to
		 * `??`-guard the one field the cumulative-returned-quantity math depends
		 * on, which is exactly how a productId-keyed collapse creeps back in.
		 */
		orderItemIndex: number;
		productId: string;
		name: string;
		sku?: string;
		quantity: number;
		price: number;
		cost: number;
		ivaType: number;
		condition: 'sellable' | 'damaged';
		/**
		 * Whether this line went back into sellable stock. SERVER-DERIVED from
		 * `condition === 'sellable'` — never accepted from a client request.
		 */
		restock: boolean;
	}

	/**
	 * Bounded projection of a return, embedded on `Order.returns` so the order
	 * read path renders return chips and per-line returned quantities without a
	 * second query (api#547). Capped at 50 per order.
	 */
	interface ReturnSummary {
		returnId: string;
		createdAt: number;
		dated: number;
		/** Credited amount — the discounted `Return.total`, not `subtotal`. */
		total: number;
		reason: ReturnReason;
		ncStatus?: ReturnCreditNoteStatus;
		creditNoteId?: string;
		/** Per-line returned quantities, keyed by originating order-array index. */
		items: { orderItemIndex: number; quantity: number; condition: 'sellable' | 'damaged' }[];
	}

	type ReturnReason =
		| 'defective'
		| 'wrong_item'
		| 'damaged_shipping'
		| 'customer_changed_mind'
		| 'not_as_described'
		| 'duplicate_order'
		| 'price_adjustment'
		| 'billing_error'
		| 'other';

	/* ------------------------------------------------------------------ */
	/*  Request DTOs (api#546 / api#547)                                   */
	/* ------------------------------------------------------------------ */

	/**
	 * `POST /orders` with `mode: 'edit'` (api#546).
	 *
	 * Server-authoritative: the API hydrates name/SKU/cost/IVA from the stored
	 * product and recomputes subtotal, discount, cost, and total. Client totals
	 * and costs are not accepted.
	 */
	interface EditOrderRequest {
		mode: 'edit';
		orderId: string;
		/**
		 * Optimistic-concurrency token — the client echoes
		 * `order.updatedAt ?? order.createdAt`. A stale value is rejected with
		 * `409 ORDER_VERSION_CONFLICT`.
		 */
		expectedUpdatedAt: number;
		/**
		 * Replacement line set. Duplicate `productId`s are legal — they are
		 * distinct order lines and keep their own prices.
		 */
		items: EditOrderRequestItem[];
		sendEmail?: boolean;
	}

	interface EditOrderRequestItem {
		productId: string;
		quantity: number;
		price: number;
	}

	/**
	 * `POST /orders` with `mode: 'return'` (api#547).
	 *
	 * Carries no product, price, cost, IVA, name, or restock field: every one is
	 * derived from the strong-read stored order so a stale or hostile client
	 * cannot dictate the credited amount.
	 */
	interface CreateReturnRequest {
		mode: 'return';
		/** Client-minted UUID; the idempotency key. A replay returns the original outcome. */
		requestId: string;
		orderId: string;
		/** Echoes `order.updatedAt ?? order.createdAt`. */
		expectedUpdatedAt: number;
		items: CreateReturnRequestItem[];
		reason: ReturnReason;
		notes?: string;
		emitCreditNote?: boolean;
		sendEmail?: boolean;
		/**
		 * Required when the order has a non-empty `linkedPayments` map: the
		 * operator acknowledges that SINFACTURA records an account credit and
		 * does NOT refund or unlink the provider payment.
		 */
		acknowledgeNoProviderRefund?: boolean;
	}

	interface CreateReturnRequestItem {
		/** Index into the originating `Order.items`. Duplicates are rejected. */
		index: number;
		quantity: number;
		condition: 'sellable' | 'damaged';
	}

	/**
	 * `POST /orders` with `mode: 'return-credit-note'` (api#547) — retry NC
	 * issuance for an already-committed return.
	 *
	 * Reuses the stored subset; creates no second return, account credit, or
	 * stock movement.
	 */
	interface RetryReturnCreditNoteRequest {
		mode: 'return-credit-note';
		returnId: string;
	}

}

export {}; // NOSONAR
