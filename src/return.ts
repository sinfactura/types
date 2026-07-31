
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
		 * request. Optional/forward-only: rows written before api#547 carry none.
		 */
		requestId?: string;

		/**
		 * Durable credit-note lifecycle (api#547). Independent of the return
		 * transaction: a committed return stays successful even when the NC is
		 * `pending` or `rejected`, and ARCA failure never rolls the return back.
		 *
		 * Optional/forward-only — absent on pre-api#547 rows, where
		 * `creditNoteEmitted` is the only signal.
		 */
		ncStatus?: ReturnCreditNoteStatus;
		/** Safe machine-readable error code when `ncStatus === 'rejected'`. Never raw ARCA payloads. */
		ncError?: string;

		createdAt: number;
		dated: number;
	}

	/**
	 * Credit-note state machine for a return (api#547).
	 *
	 * - `not_requested` — the operator did not ask for an NC.
	 * - `pending` — requested; either in flight, or an unresolved/transport
	 *   outcome left for the canonical invoice reconciliation to settle.
	 * - `authorized` — ARCA granted it; `creditNoteId` is stamped.
	 * - `rejected` — ARCA refused it; retryable via the return-credit-note mode.
	 */
	type ReturnCreditNoteStatus = 'not_requested' | 'pending' | 'authorized' | 'rejected';

	interface ReturnItem {
		/**
		 * Index of the line in the ORIGINATING `Order.items` array (api#547).
		 *
		 * Returns are identified by array index, never by `productId`: one order
		 * can carry the same product on several lines at different prices, so a
		 * productId-keyed return would collapse them and credit the wrong amount.
		 *
		 * Optional/forward-only — absent on pre-api#547 rows.
		 */
		orderItemIndex?: number;
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
