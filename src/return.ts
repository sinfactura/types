
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
		 * discount. Not what the customer is credited.
		 */
		subtotal: number;
		cost: number;
		/**
		 * The amount actually credited — `subtotal` after the originating
		 * order's discount multiplier (`1 - Order.discount / 100`). Must agree
		 * with the ACCOUNT credit row and the NC total.
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
		 * Client-supplied idempotency key — a UUID minted per submit attempt.
		 *
		 * ⚠️ The dedupe itself does NOT key off this field: the api's
		 * `withIdempotency` helper reads the `Idempotency-Key` HTTP header only
		 * (opt-in; no header = no idempotency). A client MUST send the same
		 * UUID as both `CreateReturnRequest.requestId` and the header; the body
		 * field exists so the committed RETURN row stays traceable to the
		 * request that made it. Header dedupe is scoped per user
		 * (`SK: {userId}#{key}`) with a 24h TTL.
		 */
		requestId?: string;

		/**
		 * Durable credit-note lifecycle, independent of the return
		 * transaction: a committed return stays successful even when the NC is
		 * `pending` or `rejected`, and ARCA failure never rolls it back.
		 * REQUIRED — every return records a state, `not_requested` included.
		 */
		ncStatus: ReturnCreditNoteStatus;
		/** Human-readable failure detail when `ncStatus === 'rejected'`. Never raw ARCA payloads. */
		ncError?: string;
		/**
		 * Machine-readable failure cause when `ncStatus === 'rejected'`.
		 * Distinct from `ncError`, which is prose: this is what a client branches
		 * on to decide whether the retry mode is worth offering.
		 */
		ncErrorCode?: ReturnCreditNoteErrorCode;

		createdAt: number;
		dated: number;
	}

	/**
	 * Credit-note state machine for a return: `not_requested` (no NC asked
	 * for), `pending` (in flight), `authorized` (ARCA granted; `creditNoteId`
	 * stamped), `rejected` (refused; retryable via return-credit-note mode
	 * when `ncErrorCode` says so).
	 *
	 * ⚠️ A return NC is always PARTIAL and has NO offline contingency: when
	 * ARCA is down, `POST /invoices` fails closed with
	 * `502 PARTIAL_NC_AFIP_DOWN` rather than degrading to a `pending_cae` row
	 * (which can't carry the billed subset). So an ARCA outage must land a
	 * return on `rejected` + `PARTIAL_NC_AFIP_DOWN`, never `pending` — nothing
	 * exists for reconciliation to settle, and a `pending` there hangs forever.
	 */
	type ReturnCreditNoteStatus = 'not_requested' | 'pending' | 'authorized' | 'rejected';

	/**
	 * Why a return's credit note was refused — each member a real guard on
	 * the partial-NC path behind `POST /invoices`.
	 *
	 * Retryable once the cause clears:
	 * - `PARTIAL_NC_AFIP_DOWN` — ARCA unreachable; retry when it recovers.
	 *
	 * Terminal without operator action:
	 * - `NC_MULTI_FAC_UNSUPPORTED` — order carries more than one distinct
	 *   domestic FAC, so the NC can't be attributed to one voucher.
	 * - `NC_EXCEEDS_FAC_TOTAL` — credit exceeds the FAC's remaining allowance
	 *   (FAC total − prior non-rejected NCs); not clamped at zero, so a
	 *   fully-credited FAC refuses every further return NC.
	 * - `CBTE_ASOC_NOT_FOUND` — no factura on the order matches the resolved
	 *   `cbte_numero`.
	 * - `CBTE_ASOC_NOT_CREDITABLE` — the matched voucher's own CbteTipo has no
	 *   determinate credit-note class (a Factura E, an FCE voucher, an
	 *   export/FCE ND — anything outside `NC_FOR_DOMESTIC_VOUCHER_CLASS`).
	 *   ⚠️ **PERMANENT, and the only member whose permanence is a property of
	 *   the VOUCHER rather than of a cap or a cause that could clear.** No
	 *   operator action brings it back: the invoice being credited is the wrong
	 *   KIND of invoice, so retrying the identical request can only ever produce
	 *   the identical refusal. Retryability is encoded consumer-side —
	 *   `app`'s `NC_ERROR_RETRYABLE` (`src/domain/orderReturn.ts`) is a
	 *   `Record<ReturnCreditNoteErrorCode, boolean>` written so that a code
	 *   added here fails that build rather than falling through — and this
	 *   member is `false` there.
	 *   ⚠️ It was emitted for one published version WITHOUT being a member of
	 *   this union, and the failure mode is exactly the one the api's own
	 *   `KNOWN_ASSOCIATION_CODES` comment predicted for a different cause: a
	 *   code absent from a set typed by this union collapses through
	 *   `toReturnCreditNoteErrorCode` to `NC_EMISSION_FAILED`, whose shopper/
	 *   operator copy is "revisá los datos e intentá de nuevo" — inviting a
	 *   retry that cannot succeed. Adding a code to the emitter without adding
	 *   it here does not fail any build; nothing but this docblock guards it.
	 * - `PARTIAL_NC_INVALID_SUBSET` — billed subset out of range,
	 *   over-quantity, or repeats a line index.
	 * - `PARTIAL_NC_REQUIRES_CBTE` — `partialItems` sent with no
	 *   `cbte_numero` (server-resolved — indicates an api-side defect).
	 * - `NC_EMISSION_FAILED` — anything else ARCA refused.
	 */
	type ReturnCreditNoteErrorCode =
		| 'PARTIAL_NC_AFIP_DOWN'
		| 'NC_MULTI_FAC_UNSUPPORTED'
		| 'NC_EXCEEDS_FAC_TOTAL'
		| 'CBTE_ASOC_NOT_FOUND'
		| 'CBTE_ASOC_NOT_CREDITABLE'
		| 'PARTIAL_NC_INVALID_SUBSET'
		| 'PARTIAL_NC_REQUIRES_CBTE'
		| 'NC_EMISSION_FAILED';

	interface ReturnItem {
		/**
		 * Index of the line in the ORIGINATING `Order.items` array. Returns are
		 * identified by array index, never `productId` — one order can carry
		 * the same product on several lines at different prices, so a
		 * productId-keyed return would collapse them and credit the wrong amount.
		 * REQUIRED — the handler always writes it.
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
		/** Whether this line went back into sellable stock — SERVER-DERIVED from `condition === 'sellable'`, never client-accepted. */
		restock: boolean;
	}

	/**
	 * Bounded projection of a return, embedded on `Order.returns` so the order
	 * read path renders return chips and per-line returned quantities without a
	 * second query. Capped at 50 per order.
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
		/** Human-readable failure detail when `ncStatus === 'rejected'`. Never raw ARCA payloads. Mirrors `Return.ncError`. */
		ncError?: string;
		/**
		 * Machine-readable failure cause when `ncStatus === 'rejected'`. Mirrors
		 * `Return.ncErrorCode`. Distinct from `ncError`, which is prose: this is what a
		 * client branches on to decide whether the `return-credit-note` retry mode is
		 * worth offering. Only `PARTIAL_NC_AFIP_DOWN` is retryable.
		 */
		ncErrorCode?: ReturnCreditNoteErrorCode;
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

	// Request DTOs

	/**
	 * `POST /orders` with `mode: 'edit'`. Server-authoritative: the API
	 * hydrates name/SKU/cost/IVA from the stored product and recomputes
	 * subtotal, discount, cost, and total — client totals/costs are not accepted.
	 */
	interface EditOrderRequest {
		mode: 'edit';
		orderId: string;
		/**
		 * Optimistic-concurrency token — client echoes
		 * `order.updatedAt ?? order.createdAt`. Stale value → `409 ORDER_VERSION_CONFLICT`.
		 */
		expectedUpdatedAt: number;
		/** Replacement line set. Duplicate `productId`s are legal — distinct order lines, own prices. */
		items: EditOrderRequestItem[];
		sendEmail?: boolean;
	}

	interface EditOrderRequestItem {
		productId: string;
		quantity: number;
		price: number;
	}

	/**
	 * `POST /orders` with `mode: 'return'`. Carries no product, price, cost,
	 * IVA, name, or restock field — every one is derived from the strong-read
	 * stored order so a stale or hostile client cannot dictate the credited amount.
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
		 * operator acknowledges SINFACTURA records an account credit and does
		 * NOT refund or unlink the provider payment.
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
	 * `POST /orders` with `mode: 'return-credit-note'` — retry NC issuance for
	 * an already-committed return. Reuses the stored subset; creates no
	 * second return, account credit, or stock movement.
	 */
	interface RetryReturnCreditNoteRequest {
		mode: 'return-credit-note';
		returnId: string;
	}

}

export {}; // NOSONAR
