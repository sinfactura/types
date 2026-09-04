
declare global {

	/**
	 * A coupon as it was redeemed onto an order — the grant frozen at
	 * consumption, plus the money it actually took.
	 *
	 * Deliberately NOT a reference to the live `Coupon` row: that row keeps
	 * changing (its caps move, it gets disabled, its terms are edited), and an
	 * order must record what was granted at the till, not what the code means
	 * today.
	 */
	interface OrderCoupon {
		/** Normalized upper-case, matching the `Coupon` row's own `code`. */
		code: string;
		/** The grant's unit, as frozen at redemption. */
		type: 'percent' | 'amount';
		/** The GRANT, in the unit `type` names — NOT money. See `amount`. */
		value: number;
		/**
		 * The MONEY this coupon took off this order, in the order's currency,
		 * after every clamp (`maxDiscountAmount`, and the cart's gross).
		 */
		amount: number;
		/** ms epoch the redemption was consumed — checkout, never apply. */
		redeemedAt: number;
	}

	/**
	 * One payment leg recorded at the counter.
	 *
	 * The ledger is APPEND-ONLY: legs are added in the order they were taken and
	 * are never edited or removed in place, so two readers of the same row always
	 * replay the same sequence.
	 */
	interface OrderTender {
		/** Stable per-order leg id — survives reorder and keys the FE list. */
		tenderId: string;
		/**
		 * FK to a `Store.paymentMethods` entry's `id`, resolved at write time and
		 * frozen here. The tenant may rename, reorder or remove that method
		 * afterwards; the leg keeps the id it was rung under, so do not read it as
		 * a live pointer.
		 */
		method: number;
		/** The money this leg took, in `currency`. */
		amount: number;
		/** catalogId — FK to PlatformCurrency. Self-describing per leg (ADR-0013). */
		currency: string;
		/** FX rate for `currency`, stamped when the leg is not in the order's currency. */
		currencyValue?: number;
		/**
		 * How the money arrived — a FIXED vocabulary, deliberately coarser than
		 * `method`. `method` is the tenant's own configurable method table; this is
		 * what a reader can branch on without knowing that table.
		 */
		source: 'cash' | 'card' | 'qr' | 'transfer' | 'account' | 'other';
		/** Operator- or provider-supplied trace (authorization code, ticket id, …). */
		reference?: string;
		/**
		 * Cash handed back to the customer on this leg, in `currency`. Set on a
		 * `source: 'cash'` leg ONLY — elsewhere absence means "does not apply", not
		 * zero.
		 */
		change?: number;
		/** ms epoch the leg was rung. */
		recordedAt: number;
		/** userId of the operator who rang it. */
		recordedBy?: string;
	}

	interface Order {
		storeId: string;
		orderId: string;
		customerId: string;
		customer: Partial<Customer>;
		createdAt: number;
		/**
		 * `YYYYMMDD` in Buenos Aires time (e.g. `20260810`), stamped at creation
		 * and never rewritten — the sort key of the `PK-dated` index the per-day
		 * order queries run on. Required rather than optional: rows predating the
		 * field were backfilled, and that one-shot migration has since been
		 * removed as spent.
		 */
		dated: number;
		updatedAt?: number;
		readyAt?: number;
		deliveredAt?: number;
		deliveredDate?: number;

		/**
		 * FULFILMENT axis of the two-axis order state model — where the goods
		 * are. See {@link OrderFulfilmentStatus} for the derivation rule and
		 * `ORDER_FULFILMENT_TRANSITIONS` for the legal moves.
		 *
		 * ⚠️ OPTIONAL, and permanently so. Every ORDER row written before this
		 * field existed carries no status-shaped attribute at all, and this
		 * platform is forward-only — nothing will ever backfill them. Absent is
		 * therefore a LEGAL, PERMANENT state of the data, not a migration gap:
		 * a reader must fall back to deriving from `deliveredAt`/`readyAt`, and
		 * every write-time guard must tolerate absence, i.e.
		 * `attribute_not_exists(fulfilmentStatus) OR fulfilmentStatus = :expected`
		 * — the idiom the delivery and disable writers already use for the
		 * timestamps themselves.
		 *
		 * ⚠️ Spelled with ONE `l` throughout (`fulfilment`, `Fulfilment`).
		 */
		fulfilmentStatus?: OrderFulfilmentStatus;
		/**
		 * FINANCIAL axis — what the customer still owes on this order. See
		 * {@link OrderFinancialStatus}; legal moves in
		 * `ORDER_FINANCIAL_TRANSITIONS`.
		 *
		 * ⚠️ Optional and permanently so, exactly as `fulfilmentStatus` above,
		 * and with the same absent-tolerant guard requirement.
		 *
		 * ⚠️ This is a CACHE of a figure the ledger owns. The `ACCOUNT`
		 * partition is authoritative for what is owed; this field is the
		 * ledger's verdict stamped onto the order so a list query does not have
		 * to replay a customer's whole account to colour one row. When the two
		 * disagree, the ledger is right and this field is stale.
		 */
		financialStatus?: OrderFinancialStatus;
		/**
		 * Append-only audit trail of every state move on either axis, oldest
		 * first.
		 *
		 * ⚠️ Appended with `SET statusHistory = list_append(if_not_exists(statusHistory, :empty), :entry)`
		 * — NEVER read-modify-write. Two writers advancing different axes of the
		 * same order in the same instant is ordinary (an operator marks it
		 * delivered while a payment webhook lands), and a read-modify-write
		 * silently drops one of the two entries with no error anywhere.
		 * `if_not_exists` is what makes the first append work on the whole
		 * back-catalogue, none of which carries the attribute.
		 *
		 * NOT capped, unlike `returns` — an order moves state a handful of
		 * times, so the list stays small. The one path that can oscillate is
		 * the financial axis under repeated payment link/unlink; a writer that
		 * finds itself appending in a loop is the bug, not the list.
		 */
		statusHistory?: OrderStatusEntry[];
		/**
		 * When this order's lines were applied to inventory — the `Product.stock`
		 * decrement and the `SALE#` rows.
		 *
		 * ⚠️ **A WRITE-ONCE LATCH, not a timestamp anyone reads for time.** It exists
		 * so a channel whose order write can fire more than once for the same order
		 * can still move stock exactly once: the applying transaction stamps it under
		 * `attribute_not_exists(stockAppliedAt)`, so a replay loses the condition and
		 * the whole transaction — decrement included — is rejected as a unit.
		 *
		 * ⚠️ Written ONLY by a channel that needs the latch. The ordinary counter and
		 * storefront checkouts mint an order exactly once by construction and do NOT
		 * stamp it, so **absent does not mean "stock was never applied"** — it is not
		 * a field to gate a report or a repair sweep on. Today the one writer is the
		 * MercadoLibre `orders_v2` ingest, whose upsert runs on every notification for
		 * an order's whole life.
		 *
		 * ⚠️ Optional and permanently so, like every other field added after rows
		 * existed — this platform is forward-only and nothing backfills.
		 */
		stockAppliedAt?: number;
		/**
		 * When this order's inventory application was REVERSED — the `Product.stock`
		 * credit back, the `totalSales` credit back, and the `skip` stamp on the
		 * `SALE#` rows the apply wrote.
		 *
		 * ⚠️ **A WRITE-ONCE LATCH, and the mirror of `stockAppliedAt`.** A channel
		 * that learns an order it already applied was cancelled reverses it exactly
		 * once: the reversing transaction stamps this under
		 * `attribute_exists(stockAppliedAt) AND attribute_not_exists(stockReversedAt)`,
		 * so a replayed cancellation loses the condition and the whole transaction —
		 * the stock credit included — is rejected as a unit. Both halves of that
		 * condition matter: without the first, a cancellation arriving for an order
		 * whose stock was never applied would CREATE inventory from nothing.
		 *
		 * ⚠️ Reversal does not DELETE the `SALE#` rows. They are stamped `skip`, the
		 * field the stock ledger and the reconciliation report already exclude on, so
		 * the movement stops counting while the audit trail survives. A reader that
		 * sums `SALE#` without honouring `skip` will over-report.
		 *
		 * ⚠️ Written ONLY by a channel that needs the latch — today the MercadoLibre
		 * `orders_v2` ingest. Absent means "not reversed", never "not reversible".
		 *
		 * ⚠️ Optional and permanently so, like every other field added after rows
		 * existed — this platform is forward-only and nothing backfills.
		 */
		stockReversedAt?: number;
		comments?: string;
		currency: string; // catalogId — FK to PlatformCurrency
		// Self-describing currency stamp (ADR-0013): FX rate and the Unix ms at which it was effective.
		currencyValue?: number;
		currencyValueAt?: number;
		paymentMethod: number;
		/**
		 * Payment legs rung at the counter, oldest first. APPEND-ONLY — see
		 * {@link OrderTender}. Absent on an order that was never settled at a till.
		 */
		tenders?: OrderTender[];
		/**
		 * Present only when this sale breached the customer's `creditLimit` and a
		 * cashier holding the `payments` capability proceeded anyway.
		 *
		 * ⚠️ Its presence is the record that the exception happened — a breached sale
		 * with no `creditOverride` is a defect, not an ordinary sale. The limit warns
		 * rather than blocks, and the recording is precisely what a hard block cannot
		 * produce, so this field carries the whole value of that trade.
		 *
		 * Absent on every sale inside the limit, and on every sale by a customer with
		 * no ceiling set — absence of `Customer.creditLimit` means UNLIMITED, never
		 * zero.
		 */
		creditOverride?: CreditOverride;
		/**
		 * Money received against this order, in the ORDER's `currency`.
		 *
		 * ⚠️ STORED at write time, NOT derived on read. A reader must use this
		 * field and must NOT recompute it by summing `tenders`: each leg carries
		 * its own `currency` / `currencyValue`, so a naive sum is already wrong for
		 * a mixed-currency settlement, and a reader that recomputes will disagree
		 * with the till over the same row.
		 */
		amountPaid?: number;
		/**
		 * What is still owed on this order, in the ORDER's `currency`. Same rule as
		 * `amountPaid` — stored, never recomputed by a reader from the leg ledger.
		 */
		balanceDue?: number;
		/** Which till rang the sale. A web order carries neither this nor `shiftId`. */
		terminalId?: string;
		/** The `CashShift.shiftId` this sale belongs to. A web order carries neither this nor `terminalId`. */
		shiftId?: string;
		/**
		 * Expected payment due date, Unix ms. Nothing computes it from payment
		 * terms — it is operator-declared.
		 *
		 * Feeds AFIP `FchVtoPago` at invoice time, which ARCA requires on every
		 * service voucher (Concepto 2/3) and on every FCE regardless of Concepto
		 * (code 10163). The FCE request's own `fchVtoPago` outranks it; absent
		 * both, the voucher falls back to the invoice date, which is the
		 * behaviour every goods order has always had.
		 */
		dueDate?: number;
		/**
		 * The service period this order bills for, Unix ms — the window that
		 * reaches ARCA as `FchServDesde` / `FchServHasta`.
		 *
		 * Exists because a repair received in March and delivered in June is a
		 * genuine multi-month service, and reporting it as a same-day June
		 * service misstates the invoice. Absent on an ordinary goods order, which
		 * then reports same-day exactly as before — the fields are additive and
		 * change nothing for a sale that has no service period.
		 *
		 * Operator-declared, and validated on every write that can carry them:
		 * `POST /orders` (both its insert and its update leg) rejects a
		 * half-declared window and an end preceding its start, with a 400.
		 * `mode: 'edit'` is strict and cannot carry them at all.
		 *
		 * They are therefore revisable before invoicing, which is what an operator
		 * correcting a mistyped intake date needs. Revising them AFTER an invoice
		 * exists does not rewrite it: the invoice stamps its own copy of the window
		 * at issue time, so the issued voucher and the order can legitimately
		 * disagree once someone edits the order.
		 *
		 * These are the SOURCE. `Invoice.serviceStartDate`/`serviceEndDate` are
		 * the copy stamped at issue time; the ARCA drain rebuilds a pending
		 * voucher from the live Order, so anything that must survive a
		 * contingency drain belongs here rather than on the invoice.
		 */
		serviceStartDate?: number;
		serviceEndDate?: number;
		/**
		 * The `ServiceOrder` this order bills for, set when a delivered service
		 * order mints its order. Absent on every ordinary goods order.
		 *
		 * An order carrying this holds the repair as two `isService: true` product
		 * lines — labour and parts — priced so the PAIR SUMS to the service
		 * order's own `total`. ⚠️ They are NOT priced off `laborCost` /
		 * `partsCost`: those stay GROSS, and the ticket's absolute `discount` is
		 * netted proportionally across the two lines at mint, with the second
		 * derived from the first so rounding cannot leave the pair a centavo off
		 * a fiscal document. Those lines are already-consumed work: the parts left
		 * the shelf when the technician fitted them, so the order's stock
		 * deduction skips a service line rather than moving inventory a second
		 * time.
		 *
		 * `Order.discount` is a percentage and does NOT reach those lines — and
		 * must not, since the two units cannot be added and converting between
		 * them does not round-trip. The service order is the sole owner of its own
		 * total (its own `discount` is already spent in the lines above), so the
		 * figure invoiced is the figure the customer agreed to. The percentage
		 * still applies normally to any goods bought in the same visit.
		 */
		serviceOrderId?: string;
		/**
		 * The `ServiceOrder` the ticket in `serviceOrderId` was a rework OF, copied
		 * forward verbatim at mint. Absent unless that ticket is itself a rework.
		 *
		 * It is the parent SERVICE ORDER, not the parent order — a ticket-to-ticket
		 * pointer, exactly as `ServiceOrder.parentServiceOrderId` stores it. The
		 * resolved order was considered and rejected: the parent SERVICE# row
		 * already carries its own `orderId` and `invoiceId`, so this is one point
		 * read from the parent's money either way, and resolving at mint would add
		 * a read inside the delivery transaction plus a "parent never delivered, so
		 * it has no order" branch on a path whose only failure maps to
		 * `409 SERVICE_ORDER_STATUS_CHANGED`.
		 *
		 * A statutory warranty rework (Ley 24.240 art. 23) deliberately does NOT
		 * reopen the parent — that would destroy the parent's cycle time and its
		 * invoice linkage. This field is what keeps the rework's paperwork joined
		 * to the original repair without reopening anything. The sparse GSI
		 * `PK-parentServiceOrderId` answers "every rework of parent X" directly —
		 * keyed on the SERVICE partition and served by
		 * `GET /services?parentServiceOrderId=`.
		 */
		parentServiceOrderId?: string;
		/**
		 * FK into `Store.deliveryMethods`. OPTIONAL, matching `Customer.deliveryMethod`
		 * — `_deliverOrder.ts`'s mint already omits it when the store's catalog
		 * resolves no canonical pickup method, and `orders/_post.ts`'s write-boundary
		 * validation has always modelled it that way (`z.number().optional()`). A
		 * required type here disagreed with what the api actually produces.
		 *
		 * ⚠️ Same reader contract as `Customer.deliveryMethod`: resolve against the
		 * store's catalog and tolerate a miss, and don't read the id as meaningful on
		 * its own — method ids are per-catalog ordinals.
		 */
		deliveryMethod?: number;
		invoiceMethod?: {
			condFiscal: number;
			condFiscalName: string;
			cuit: string;
			razonSocial: string;
			/**
			 * Explicit per-order ARCA receptor identity, decoupled from condFiscal
			 * (ARCA DocTipo: 80 = CUIT, 96 = DNI, 99 = Consumidor Final — a
			 * SEPARATE axis from condFiscal, sharing 96 only by coincidence).
			 * When present, the AFIP invoice builder uses these directly for the
			 * receptor instead of deriving from condFiscal.
			 */
			docType?: number;
			docNumber?: string; // CUIT (11-digit + checksum) / DNI (7-8 digit)
		};
		cost: number;
		/**
		 * What the customer was **CHARGED** — net of `discount` and of any coupon
		 * cut recorded in `coupons`. Not a gross line-sum.
		 *
		 * ⚠️ **Do not re-apply `discount` to this value.** It is already spent
		 * here, so a consumer that subtracts it again double-cuts the order. Both
		 * are `number`, so nothing typechecks the mistake, and the wrong figure is
		 * plausible rather than absurd — which is why it survives review.
		 *
		 * The denomination is CHARGED rather than GROSS because a gross contract
		 * is not reconstructible downstream: the sales report projects only
		 * `total`, `deliveredDate`, `cost` and `disabled` — no discount, no items —
		 * so under GROSS it could not compute what was actually taken. Every
		 * create-leg writer stamps it net, and it is server-owned
		 * (`SERVER_OWNED_ORDER_FIELDS`), so a client-supplied value is stripped
		 * rather than honoured; that is what makes the writer set closed rather
		 * than a sample.
		 */
		total: number;
		/**
		 * Order-level discount as a PERCENTAGE (0–100), applied per line over the
		 * GROSS line prices. Not money — the cart's `totals.discount` is the
		 * absolute figure, and the two are different units.
		 *
		 * ⚠️ When a cart coupon AND an operator percentage are both present they
		 * COMPOSE, multiplicatively:
		 *
		 * ```
		 * discount = 100 × (1 − (1 − coupon/100) × (1 − operator/100))
		 * ```
		 *
		 * NOT added. The two cuts stand on different bases — 30% off, then 20% off
		 * the remainder, is 44%, not 50% — so adding them overstates the discount
		 * and two legal grants can sum past 100. And NOT "operator wins": the
		 * coupon's redemption is consumed whether or not its money survives, so
		 * dropping the coupon's half would spend a shopper's coupon and charge them
		 * full price.
		 *
		 * The full order of operations is `line discounts → coupon → order
		 * percentage`, each stage taken on what the previous one left.
		 *
		 * ⚠️ Composed on the CREATE leg only. An update reaches no cart, so an
		 * existing order's `discount` stands exactly as it was.
		 *
		 * ⚠️ A client must NOT re-derive this. The server applies the composed
		 * percentage per line over gross prices; computing `grandTotal −
		 * grandTotal × (operator/100)` on an already-netted total agrees only up to
		 * per-line rounding, so a client-side preview disagrees with the printed
		 * receipt by centavos rather than merely duplicating it.
		 */
		discount: number;
		/**
		 * The cart-level coupon(s) redeemed to mint this order, frozen at the
		 * moment the redemption was CONSUMED. Absent on every order minted
		 * without one, and on every order written before this field existed.
		 *
		 * ⚠️ **An ARRAY even though a cart holds at most one coupon**, and that is
		 * not speculative generality. The asymmetry is what decides it: a CART is
		 * ephemeral, so singular is right there and renaming a live cart field is
		 * a patch bump plus a mechanical sweep. An ORDER ROW IS IMMUTABLE HISTORY,
		 * and this repo is forward-only with no backfills — reshaping a singular
		 * field into an array later means a migration nobody will run, against
		 * rows nobody can rewrite. The array costs nothing now and removes the
		 * only expensive half of a future stacking decision. **Today it holds at
		 * most one entry.**
		 *
		 * ⚠️ **`amount` here is the money the coupon actually took off THIS
		 * order** — not the coupon's `value`, which is the grant in the unit
		 * `type` names. A percent coupon whose `value` is 15 may have an `amount`
		 * of 4 500. Reading `value` as money is the mistake this pair exists to
		 * prevent, and both are `number`, so nothing typechecks it for you.
		 *
		 * ⚠️ **Do not derive "was a coupon used" by arithmetic on `total`.**
		 * Subtracting the line cuts from the item sum will silently absorb
		 * shipping and tax the moment those reserved `CartTotals` slots are
		 * populated. This field is the record; the arithmetic is not.
		 *
		 * A RETURN may report that a redemption was taken against this order. It
		 * must NOT release one — releasing is the failure mode that vendors with
		 * an explicit session-lock primitive exist to manage, and there is no such
		 * primitive here. The same holds for the operator's **reversible** disable:
		 * it is a toggle, so releasing on it would hand the redemption back every
		 * time an operator flipped the row.
		 *
		 * ⚠️ **The one-way customer cancel is the documented exception, and it
		 * DOES release.** That path is terminal — nothing re-enables the order —
		 * so the objection above does not apply to it, and withholding the release
		 * there strands a redemption the customer never consumed. Read this field
		 * as "a redemption was taken", never as "a redemption is still held".
		 *
		 * The asymmetry is deliberate and is decided by REVERSIBILITY, not by who
		 * cancelled: any future terminal path releases, any future toggle does
		 * not. Because a release is not idempotent, the releasing path carries its
		 * own stamp — the `COUPON_USE#` row does not record an `orderId`, so
		 * nothing else can tell a second release from a first.
		 */
		coupons?: OrderCoupon[];
		orderPrinted?: boolean;
		tagPrinted?: boolean;
		/**
		 * Server-derived ms epoch, stamped by the WSS `ack` handler on an
		 * `ACK_PRINTED` correlating to this row's CURRENT `printJobId`.
		 * Absent = not confirmed printed — never seeded to `0`, unlike
		 * `readyAt`/`deliveredAt`. Cleared on every reprint. Distinct from
		 * `orderPrinted`, which is stamped optimistically at dispatch.
		 */
		printedAt?: number;
		/** BE-minted pointer to the most recent print dispatch. Last-write-wins on reprint. */
		printJobId?: string;
		invoices?: Partial<Invoice>[];
		/**
		 * Bounded, embedded projections of this order's returns, capped at 50.
		 * The canonical rows live under `RETURN#${storeId}`.
		 */
		returns?: ReturnSummary[];

		/**
		 * Customer self-cancellation, DISTINCT from `disabled` (operator
		 * soft-delete) — `disabled` additionally stamps
		 * `readyAt`/`deliveredAt`/`deliveredDate`, which cancellation must NOT do.
		 * All four fields are absent on a non-cancelled order.
		 */
		cancelledAt?: number;
		/** Who cancelled: the customerId for a self-cancellation, else the userId. */
		cancelledBy?: string;
		cancellationSource?: OrderCancellationSource;
		/** Bounded free text supplied by the canceller. */
		cancellationReason?: string;
		// Auto-credit-note status stamped once an NC is emitted (or attempted)
		// against this ML order; FE renders "NC emitida" from this.
		mercadolibreCreditNote?: {
			creditNoteNumber?: number; // the emitted NC's ARCA CbteNro
			// Ms epoch of a successful emission — also the idempotency marker the
			// emit-decision conditional-writes against (no double-NC per order).
			emittedAt?: number;
			status?: "emitted" | "skipped" | "failed";
			reason?: string; // populated on skip/failure — guard reason or error code
			claimId?: string; // the ML claim that triggered the emission (audit)
			source?: 'auto' | 'manual';
		};
		disabled?: boolean;
		// Orders copy cart lines verbatim. `CartLine` is structurally a superset of
		// `BasketItem`, so a re-keyed cart's lines land here — `lineId` included —
		// whether or not the type admits it. Widened so the declaration stops lying.
		items: Partial<CartLine>[];
		rating?: number;
		comment?: string;
		surveyDate?: number;
		deliveryAddress?: {
			fullName: string;
			address: string;
			phone: string;
			city: string;
			province: string;
			postalCode: string;
		};
		// DYNAMIC QR cache — present when an MP dynamic QR is currently issued
		// for this order. Cleared lazily on payment received.
		mercadopago?: {
			dynamicQr?: {
				qrData: string;             // raw EMVCo string (FE renders to QR image)
				inStoreOrderId: string;     // MP's id for the in-store order — handle for cancel/refresh
				posId: string;              // dynamic POS that minted this QR
				externalReference: string;  // = orderId
				amount: number;             // smallest currency unit (centavos)
				currency: string;
				expiresAt: number;          // unix ms
				createdAt: number;          // unix ms
			};
		};
		// Denormalized linked-payment metadata, keyed by paymentId so DELETE is
		// `REMOVE linkedPayments.#pid` (atomic, race-safe) instead of array splice.
		linkedPayments?: Record<string, LinkedPaymentEntry>;
		// Sales-channel tag (ADR-0018 Decision 1) — absent means the order
		// originated in SINFACTURA itself. Channel-tagged orders flow through
		// the SAME AFIP/stock/reporting pipelines, no parallel collection.
		channel?: OrderChannel;
		// Provider sub-record for `channel: 'meli'` orders.
		mercadolibre?: OrderMercadolibre;
	}

	type OrderChannel = 'meli';

	/**
	 * Who initiated a cancellation. `customer` is the storefront self-service
	 * path; `operator` is reserved for a future back-office cancellation,
	 * still distinct from `disabled`.
	 */
	type OrderCancellationSource = 'customer' | 'operator';

	/**
	 * Machine-readable reason an order is locked against a mutation — the
	 * payload of `409 ORDER_LOCKED` / `409 ORDER_CANCELLATION_LOCKED`, and the
	 * gate a return checks before it starts. Clients map these to copy; never
	 * user-facing strings themselves.
	 *
	 * ⚠️ Every predicate is a `> 0` test, NOT a presence test. `POST /orders`
	 * stamps `readyAt`/`deliveredAt`/`deliveredDate` at `0` on creation, so an
	 * `attribute_exists` check matches every order ever created and silently
	 * inverts the lock. The api's `assessLock` is the reference.
	 *
	 * Evaluated in this order, first match wins:
	 * - `ready` — `readyAt > 0`.
	 * - `delivered` — `deliveredAt > 0` or `deliveredDate > 0`.
	 * - `disabled` — `disabled === true` (soft-delete; NOT cancellation).
	 * - `invoiced` — `invoices[]` holds a voucher that is not `rejected`/`voided`.
	 *   A voucher with no `fiscalStatus` at all is legacy and counts as live.
	 * - `payment-linked` — `linkedPayments` is non-empty. The platform never
	 *   unlinks or refunds a provider payment on the operator's behalf.
	 * - `cancelled` — `cancelledAt` is stamped.
	 */
	type OrderLockReason = 'ready' | 'delivered' | 'disabled' | 'invoiced' | 'payment-linked' | 'cancelled';

	/**
	 * FULFILMENT axis of the order state model: where the goods are.
	 *
	 * The frontend has run this axis in production for years with no server
	 * field to lean on, deriving it from the timestamps. This union names what
	 * it already computes, so a consumer can switch from the derivation to the
	 * stored field WITHOUT any bucket count moving.
	 *
	 * ⚠️ **DERIVATION, when the field is absent — `deliveredAt` OUTRANKS
	 * `readyAt`, in that order, and nothing else participates:**
	 *
	 * ```
	 * deliveredAt > 0            -> 'delivered'
	 * else readyAt > 0           -> 'ready'
	 * else                       -> 'pending'
	 * ```
	 *
	 * The order of those two tests is load-bearing, not stylistic. The
	 * lifecycle is monotone, so a delivery stamp outranks a MISSING ready
	 * stamp: an order delivered without ever being marked ready is
	 * `delivered`, never `pending`. Testing `readyAt` first is a bug the app
	 * already had and fixed — it sent delivered orders back to the first
	 * bucket on one screen while another screen counted them under the last.
	 *
	 * ⚠️ The api's `assessLock` tests `readyAt` FIRST. That is correct for a
	 * LOCK reason (both answers lock the order, so nothing observable differs)
	 * and WRONG as a derivation of this axis. Do not reuse it here.
	 *
	 * ⚠️ Every predicate is `> 0`, never a presence test: `POST /orders` stamps
	 * `readyAt`/`deliveredAt`/`deliveredDate` at `0` on creation, so
	 * `attribute_exists` matches every order ever written and inverts the rule.
	 *
	 * ⚠️ `deliveredAt` (Unix ms) is the authoritative delivery input, NOT
	 * `deliveredDate` (`YYYYMMDD`). The two are written and cleared together by
	 * every delivery writer, so they agree today; `deliveredDate` exists for
	 * same-calendar-day reconciliation of the balance movement, and deriving
	 * this axis from it would couple the state model to that accounting rule.
	 *
	 * **`disabled` is NOT a value here and must never become one.** A
	 * soft-deleted order still occupies its fulfilment bucket and is still
	 * rendered; it drops out of the MONEY instead, through the net-total rule.
	 * Folding the flag into this union would silently empty operator bucket
	 * counts on screens that work today. (Be aware of the api's own wrinkle:
	 * its soft-delete writer stamps `readyAt`/`deliveredAt`/`deliveredDate`
	 * with real timestamps as a hiding mechanism, so a disabled order DERIVES
	 * as `delivered` and its re-enable zeroes all three back to `pending`.
	 * Those two writes rewrite the underlying timestamps wholesale — they
	 * RECOMPUTE this field rather than requesting a transition, and are the one
	 * documented exemption from the transition table below.)
	 *
	 * **`cancelled` is NOT a value here either — cancellation is a THIRD
	 * axis**, carried by `cancelledAt`/`cancelledBy`/`cancellationSource`. It
	 * is orthogonal by construction: a cancelled order keeps whatever
	 * fulfilment state it had reached, and the two flags are already tested
	 * separately everywhere (`cancelledAt` is deliberately distinct from
	 * `disabled`, and the customer-cancellation handler short-circuits on it
	 * before any lock assessment runs). Collapsing it into this union would
	 * both destroy that information and move a cancelled order out of the
	 * bucket the app still shows it in.
	 *
	 * `not_delivered` is the one value NOT derivable from today's rows: it
	 * means a delivery ATTEMPT failed or was cancelled by the carrier, which no
	 * timestamp can express and which is currently dropped on the floor by the
	 * MercadoLibre shipment sync. Adding it is therefore additive — no existing
	 * row derives it, so no bucket moves. Its wire spelling matches the
	 * marketplace's own `not_delivered` shipment status.
	 */
	type OrderFulfilmentStatus = 'pending' | 'ready' | 'delivered' | 'not_delivered';

	/**
	 * FINANCIAL axis of the order state model: what the customer still owes on
	 * this order.
	 *
	 * English values for a verdict the frontend renders in Spanish. The
	 * bucketing must agree with the FIFO allocation the app already runs over
	 * the customer's whole `ACCOUNT` ledger:
	 *
	 * ```
	 * 'paid'    <- 'Pagada'    debit - paid <= epsilon
	 * 'partial' <- 'Parcial'   still owing, and something has been paid
	 * 'pending' <- 'Pendiente' still owing, and nothing has been paid
	 * ```
	 *
	 * ⚠️ `epsilon` is half a display unit, derived from the store's
	 * `priceDecimals`: a shortfall the store cannot even render is not a
	 * shortfall. An exact-zero test disagrees with the app on every order whose
	 * FIFO allocation leaves a sub-centavo residual, and puts a live "collect"
	 * button next to a paid chip.
	 *
	 * ⚠️ A zero-debit order is `paid`, not `pending` — `0 - 0 <= epsilon`. An
	 * overpaid order is also `paid`; the surplus is the customer's balance, not
	 * this order's business.
	 *
	 * ⚠️ One order can carry debits in more than one denomination. These three
	 * values describe the PRIMARY (most open) slice only, exactly as the app's
	 * per-document status does — a consumer asking "is this settled?" must
	 * consult the ledger's open-balance answer, not just this field.
	 *
	 * ⚠️ **This axis is REVERSIBLE and not monotone.** A payment can be
	 * unlinked from an order and a provider payment can be refunded, both of
	 * which move `paid` back to `partial` or `pending`; a credit note or return
	 * moves it the other way by shrinking the debit. See
	 * `ORDER_FINANCIAL_TRANSITIONS`, which has no terminal state for exactly
	 * this reason.
	 */
	type OrderFinancialStatus = 'pending' | 'partial' | 'paid';

	/**
	 * One entry in an order's append-only status history — a discriminated
	 * union over the axis that moved, because `pending` is a member of BOTH
	 * status unions and `status` alone therefore cannot tell you which axis an
	 * entry describes.
	 */
	type OrderStatusEntry = OrderFulfilmentStatusEntry | OrderFinancialStatusEntry;

	interface OrderStatusEntryBase {
		/** Unix ms when the move was committed. */
		timestamp: number;
		/**
		 * Who moved it. ABSENT when the mover was the platform itself — a
		 * marketplace shipment webhook, a payment provider hook, a scheduled
		 * drain. Those writers have no operator, and stamping a placeholder id
		 * would make the audit trail lie about who acted.
		 */
		userId?: string;
		/** Operator free text. Operator-only — never broadcast to a customer socket. */
		notes?: string;
	}

	interface OrderFulfilmentStatusEntry extends OrderStatusEntryBase {
		axis: 'fulfilment';
		status: OrderFulfilmentStatus;
		/**
		 * The state moved FROM. Absent when the row carried no
		 * `fulfilmentStatus` at the time — the whole back-catalogue, and
		 * permanently so under the forward-only rule.
		 */
		from?: OrderFulfilmentStatus;
	}

	interface OrderFinancialStatusEntry extends OrderStatusEntryBase {
		axis: 'financial';
		status: OrderFinancialStatus;
		/** The state moved FROM; absent when the row carried no `financialStatus`. */
		from?: OrderFinancialStatus;
	}

	// WRITE-side shape of the credit-note stamp above — what
	// `stampCreditNoteStatus` persists onto `Order.mercadolibreCreditNote`.
	// `source` is REQUIRED here; on the READ projection it stays optional
	// (pre-existing stamps lack it), hence the separate named interface.
	interface MercadolibreCreditNoteStamp {
		creditNoteNumber?: number;
		emittedAt?: number;
		status?: 'emitted' | 'skipped' | 'failed';
		reason?: string;
		claimId?: string;
		source: 'manual' | 'auto';
	}

	// ML-side identity + ingest-stamped provider data for a channel-tagged
	// order. Billing fields persist the RAW two-step billing-info v2 values
	// (`invoice_type` no longer exists on the wire) — Factura A/B mapping is
	// the auto-invoice hook's job. All PII.
	interface OrderMercadolibre {
		mlOrderId: string;
		packId?: string; // group unit — fiscal_documents upload target
		buyerNickname?: string;
		shipmentId?: string;
		// e.g. 'fulfillment' (Full — stock mirror-only, never restock locally),
		// 'cross_docking', 'self_service'.
		logisticType?: string;
		// ML's own `last_updated` (epoch ms) — the out-of-order-event guard for
		// the orders_v2 conditional upsert, kept separate from `Order.updatedAt`
		// so unrelated local writes never interfere with ML's own event clock.
		mlLastUpdated?: number;
		// ML's own `order.status === 'paid'` — the auto-invoice hook's trigger
		// signal, denormalized off `MeliOrderDetail`.
		paid?: boolean;
		items?: OrderMercadolibreItem[];
		// Marketplace fees stamped at ingest, self-describing per ADR-0013 —
		// feeds order-detail net proceeds + margin analytics.
		fees?: {
			saleFee?: number;
			shippingCostSeller?: number;
			currency: string; // catalogId
			currencyValue?: number;
			currencyValueAt?: number;
		};
		// Raw billing-info v2 fields (GET /orders/billing-info/MLA/{id}) —
		// feeds the missing-CUIT-for-A discrepancy badge.
		billingInfo?: {
			docType?: string; // identification.type — 'CUIT' | 'DNI' | 'CUIL' | ...
			docNumber?: string;
			custType?: 'CO' | 'BU'; // consumer | business
			taxpayerType?: string;
			iibbNumber?: string; // taxes.iibb_number
		};
		// Order-level health signals for Orders/Order-screen badges. Computed
		// best-effort at sync/auto-invoice time; a flag is absent until evaluated.
		discrepancies?: {
			priceMismatch?: boolean; // ML line unit_price ≠ SKU-linked Product price
			oversell?: boolean; // ordered qty > SKU-linked Product available stock
			missingCuit?: boolean; // billing info yields no valid CUIT for Factura A
			/**
			 * How many of this order's ML lines carried an `mlItemId` that resolves to
			 * no local product, so the line could not move `Product.stock`.
			 *
			 * ⚠️ Unlike its three siblings this is a COUNT, not a boolean, and `0` is a
			 * meaningful value: it says the order was graded and every line resolved.
			 * Absent means not graded. A truthiness test therefore reads a fully-linked
			 * order and an ungraded one identically — compare against `undefined`.
			 *
			 * It exists because an unlinked line is the one case where the sale is real
			 * and the inventory move is silently impossible; leaving it unrecorded
			 * reproduces the un-decremented counter for exactly the products most likely
			 * to be mis-linked.
			 */
			unlinkedLines?: number;
		};
		/**
		 * `fiscal_documents` upload outcome. Absent = no invoice issued yet.
		 *
		 * - `pending` — claimed, in flight.
		 * - `uploaded` — ML holds our document. The one TERMINAL-SUCCESS value, and
		 *   the only one the re-upload route and the claim guard refuse.
		 * - `failed` — the last attempt failed AND the automatic drain still owns
		 *   it. Transient by construction: an operator has nothing to do here.
		 * - `needs-attention` — the drain is done and the document is still not
		 *   uploaded. Either the failure was never retryable, or every retry was
		 *   spent. This is the ONLY value that asks a human to act.
		 *
		 * ⚠️ `failed` narrowed when `needs-attention` was added. It used to be
		 * stamped BEFORE retryability was considered, so it covered both meanings
		 * and an order that hit one 503 sat "failed" for hours while the sweeper
		 * healed it. A reader that treats `failed` as actionable is now reading the
		 * pre-narrowing contract.
		 *
		 * ⚠️ Not an exhaustiveness-checked union anywhere — no consumer switches on
		 * it, so adding a member fails no build. Readers comparing against a single
		 * literal keep compiling and silently mis-classify the new value.
		 */
		fiscalDocumentStatus?: 'uploaded' | 'failed' | 'pending' | 'needs-attention';
		/**
		 * The raw failure reason for the CURRENT `failed`/`needs-attention` state —
		 * the same string the retry row and the ERROR row carry, e.g. `network`,
		 * `pdf-too-large`, `http-error:409`.
		 *
		 * Diagnostic, not a control value: the `http-error:` arm is open-ended, so
		 * branch on {@link fiscalDocumentFailureKind} and render this. Cleared on
		 * `uploaded` and on a fresh `pending` claim — a reason outliving the attempt
		 * it describes is worse than none.
		 */
		fiscalDocumentReason?: string;
		/**
		 * The CLASSIFIED failure, for a reader that has to decide what to show and
		 * whether its retry button can honestly succeed.
		 *
		 * Exists because the raw reason cannot answer that: `http-error:409` is the
		 * Facturador collision — ML already holds a document, ours is not it, and
		 * the buyer is not missing anything — while `http-error:400` is a rejection
		 * only a change on our side can fix. Both flatten to "an HTTP error".
		 */
		fiscalDocumentFailureKind?: MlFiscalDocumentFailureKind;
	}

	/**
	 * Why a `fiscal_documents` upload is not going to succeed on its own.
	 *
	 * Closed deliberately, and coarser than the raw reason set: it names what the
	 * READER must do differently, not what the transport did. Add a member only
	 * when a consumer would genuinely act differently on it.
	 *
	 * - `facturador-collision` — ML answered 409, or said a document is already
	 *   attached. A rival invoicer (ML's own Facturador) got there first. The
	 *   buyer HAS a fiscal document; it is not ours. Retrying cannot win.
	 * - `document-rejected` — ML refused our document on its merits (a 4xx that is
	 *   not a collision, an oversized PDF). Fix the document, then re-upload.
	 * - `connection` — the store's ML connection cannot authorize the call
	 *   (`no-token`). Reconnecting is the remedy, and it is not order-specific.
	 * - `ml-unavailable` — transport or ML-side fault survived every retry
	 *   (`network`, `rate-limited`, 5xx). Nothing is wrong with the document; a
	 *   manual re-upload later is the honest suggestion.
	 * - `internal` — we threw before ML ever answered. Ours to fix, and the one
	 *   value that should never appear in a healthy fleet.
	 */
	type MlFiscalDocumentFailureKind =
		| 'facturador-collision'
		| 'document-rejected'
		| 'connection'
		| 'ml-unavailable'
		| 'internal';

	// Line-level ML identity + stock provenance, persisted for the
	// multi-warehouse foundation + Full no-decrement rule.
	interface OrderMercadolibreItem {
		mlItemId: string;
		variationId?: string;
		userProductId?: string; // UP-variant identity (User Products migration).
		sellerSku?: string;
		quantity: number;
		stock?: {
			mlStoreId?: string; // ML store_id of the fulfilling location.
			networkNodeId?: string; // multi-origin network node.
		}[];
	}

	interface LinkedPaymentEntry {
		source: 'mp' | 'stripe' | 'mp_movement';
		total: number;
		linkedAt: number;
	}

	/**
	 * The body of `POST /orders` on the CREATE / UPDATE path — the one carrying no
	 * `mode`. (`mode: 'edit'` is `EditOrderRequest`; `mode: 'return'` is
	 * `CreateReturnRequest`.)
	 *
	 * Order fields ride this body straight onto the stored row, which is why it
	 * extends `Partial<Order>`. Everything declared HERE is the opposite: a field
	 * that ROUTES or DIRECTS the request and is deliberately stripped before the
	 * write. None of them is ever readable back off a stored `Order` — do not
	 * reach for `order.cartId` or `order.counterSale` on a row you read.
	 */
	/**
	 * One tender leg as a CLIENT sends it — the RAW input the create route and
	 * `mode: 'tender'` both validate, deliberately narrower than the persisted
	 * {@link OrderTender}.
	 *
	 * ⚠️ `tenderId`, `currency`, `currencyValue` and `recordedAt`/`recordedBy` are
	 * absent BY DESIGN: the server mints and stamps every one of them. Sending
	 * them does not fail — zod object schemas STRIP unknown keys rather than
	 * refusing them — so a client coding against the persisted shape gets a 200
	 * with its invented ids silently discarded, which is why this exists as its
	 * own exported type rather than as a docblock on the persisted one.
	 *
	 * `source` is `OrderTender['source']` rather than a restated union, so the
	 * vocabulary cannot drift between the input and the row it becomes.
	 */
	/**
	 * The stored record of a credit-limit override — who, why and when.
	 *
	 * Only `reason` travels from the client (see {@link CreateOrderRequest.creditOverride});
	 * `byUserId`, `byName` and `at` are stamped server-side from the token, so a client
	 * cannot attribute its own override to somebody else.
	 */
	interface CreditOverride {
		/** The cashier's justification. Free text, client-supplied, never inferred. */
		reason: string;
		/** Stamped from the caller's token. */
		byUserId: string;
		/** Denormalized at write time so the record survives a rename. */
		byName?: string;
		/** ms epoch. */
		at: number;
	}

	interface TenderLegInput {
		/** FK to a `Store.paymentMethods` entry's `id`. Validated server-side against the tenant's live method table. */
		method: number;
		/** The money this leg takes. Must be positive — a reversal is its own leg, not a negative one. */
		amount: number;
		/** How the money arrived. See {@link OrderTender.source}. */
		source: OrderTender['source'];
		/**
		 * Cash handed back to the customer on this leg. Rejected on any leg whose
		 * `source` is not `'cash'` — this is the one field of the five that errors
		 * rather than being stripped.
		 */
		change?: number;
		/** Operator- or provider-supplied trace (authorization code, ticket id, a reversed leg's `tenderId`, …). */
		reference?: string;
	}

	interface CreateOrderRequest extends Omit<Partial<Order>, 'tenders' | 'creditOverride'> {
		/**
		 * Sent ONLY when the cashier proceeded past a credit-limit warning. Carries
		 * the reason and nothing else — the server stamps `byUserId`/`byName`/`at`
		 * from the token, which is why this is narrowed rather than inherited from
		 * {@link Order.creditOverride}.
		 *
		 * ⚠️ A client that sends the persisted shape does NOT get to set who
		 * overrode: the extra keys are stripped, not honoured.
		 */
		creditOverride?: { reason: string };
		/**
		 * Tender legs to ring against this order, as RAW input — NOT the persisted
		 * `Order.tenders`, which is why `Partial<Order>` is narrowed with `Omit`
		 * above rather than inherited whole. See {@link TenderLegInput}.
		 */
		tenders?: TenderLegInput[];
		/**
		 * The cart to build this order from, named explicitly.
		 *
		 * ⚠️ For a WALK-IN ticket this is the only thing that works. A walk-in cart
		 * has no `customerId` at all and the `PK-customerId` index is sparse, so the
		 * customer lookup cannot reach it by any route. Omit `cartId` on a walk-in
		 * conversion and the server resolves the named CUSTOMER's own cart instead —
		 * converting a different row, or none, while the scanned lines sit in a
		 * ticket nobody converted.
		 *
		 * It is also required for correctness on a NON-walk-in POS sale: a customer
		 * can own several carts at once (their own web cart, plus any till's ticket
		 * for them), so resolving by customer makes the server guess which one the
		 * cashier is holding. The till already knows — send it.
		 *
		 * Satisfies the "name something to build from" gate on its own: a request
		 * carrying `cartId` needs neither `orderId` nor `customerId`.
		 *
		 * ⚠️ NOT stored on the order. It routes the request and is stripped before
		 * the write.
		 */
		cartId?: string;
		/** Counter sale — a request directive, stripped before the write, never stored. */
		counterSale?: boolean;
		/** Send the order's SMS notification. Directive only, never stored. */
		sendSms?: boolean;
		/** Persist `deliveryAddress` as the customer's default. Directive only, never stored. */
		saveAsDefault?: boolean;
		/**
		 * Attributes to REMOVE from the stored order, rather than set — clearing a
		 * date needs an explicit removal, since an omitted key means "leave it".
		 */
		removeFields?: ('serviceStartDate' | 'serviceEndDate' | 'dueDate')[];
	}

	interface ZebraTag {
		orderId: string;
		fullName: string;
		phone: string;
		address: string;
		city: string;
		quantity: number;
		comments: string;
		sender: {
			razonSocial: string;
			cuit: string;
			phone: string;
			address: string;
			city: string;
			postalCode: string;
			province: string;
		};
	}

}

/* -------------------------------------------------------------------------- */
/*  Order state model — the legal moves on each axis                          */
/* -------------------------------------------------------------------------- */

/*
 * Deliberately NOT `declare global`, unlike everything above: a transition
 * table is needed as a VALUE (to answer "is this move legal", to build the
 * `allowed` set a 409 echoes back, and to seed a request validator), so import
 * it:
 *
 * ```ts
 * import { ORDER_FULFILMENT_TRANSITIONS, ORDER_FULFILMENT_STATUSES } from 'sinfactura-types';
 * ```
 *
 * Both tables are `Record<Status, …>` over the whole union, so adding a status
 * without giving it a row is a TYPECHECK FAILURE. That is the point: a table
 * built from an array of pairs, or a `Partial<Record<…>>`, compiles clean while
 * one status silently has no legal move at all.
 *
 * These tables state which moves are LEGAL, not which guards a given writer
 * applies. A writer may be more restrictive than the table — the marketplace
 * shipment sync is, treating `delivered` as terminal for itself so a replayed
 * or out-of-order webhook can never un-deliver an order — and that stays a
 * property of the writer.
 */

/**
 * Legal moves on the fulfilment axis.
 *
 * `pending -> delivered` is legal DIRECTLY and must stay that way: the
 * marketplace shipment sync writes a delivery onto an order that was never
 * marked ready, and the derivation rule on {@link OrderFulfilmentStatus} maps
 * exactly that row to `delivered`. A table that forced delivery through `ready`
 * would 409 a webhook that describes something that already happened.
 *
 * `not_delivered` sits LATERAL to `ready`, reachable from both `pending` and
 * `ready` and leading back to either `ready` (the carrier re-attempts) or
 * `delivered` (it succeeds on the retry). It is not terminal — a failed
 * delivery attempt is a setback, not an ending — and it is not reachable from
 * `delivered`, because nothing un-delivers an order by failing to deliver it.
 *
 * `delivered -> ready` is the operator's explicit un-delivery, which exists and
 * is same-calendar-day only (it reverses a balance movement and an account row
 * that are reconciled per day). It lands on `ready` rather than `pending`
 * because un-delivery does not clear `readyAt`. There is therefore NO terminal
 * fulfilment state — `ORDER_FULFILMENT_TERMINAL_STATUSES` is empty by
 * construction, and it is derived rather than hand-listed so it can never
 * disagree with the table.
 *
 * There are no self-edges: re-requesting the current status is a no-op, not a
 * transition.
 */
export const ORDER_FULFILMENT_TRANSITIONS: Readonly<Record<OrderFulfilmentStatus, readonly OrderFulfilmentStatus[]>> = {
	pending: ['ready', 'delivered', 'not_delivered'],
	ready: ['delivered', 'not_delivered'],
	not_delivered: ['ready', 'delivered'],
	delivered: ['ready'],
};

/**
 * Legal moves on the financial axis — every one of them, in both directions.
 *
 * This table is fully connected ON PURPOSE, and saying so is more honest than
 * inventing a restriction. The financial state is a DERIVED, reversible verdict
 * over the ledger: linking a payment moves it forward, unlinking or refunding
 * one moves it back, and a credit note or return can settle an order by
 * shrinking the debit rather than by paying it. No sequence of those is
 * illegal, so this table can never return an illegal move.
 *
 * It exists for the two things it still buys: the `Record` proves every status
 * has been considered, and the resolver built on it gives the financial axis
 * the same no-op detection and same compare-and-set precondition shape as the
 * fulfilment axis, so one writer pattern covers both.
 */
export const ORDER_FINANCIAL_TRANSITIONS: Readonly<Record<OrderFinancialStatus, readonly OrderFinancialStatus[]>> = {
	pending: ['partial', 'paid'],
	partial: ['pending', 'paid'],
	paid: ['pending', 'partial'],
};

/*
 * The value lists are DERIVED from the tables' keys rather than written out a
 * second time. A hand-written `as const satisfies readonly Status[]` array
 * proves every member is valid but NOT that the list is complete, so a new
 * status would compile clean while a request validator built on the array
 * silently 400s it. Taking the keys of an exhaustive `Record` cannot omit one.
 *
 * The assertion to a non-empty tuple is sound for the same reason — the record
 * type has at least one key — and it is what a schema builder needs.
 */

/** Every fulfilment status, in lifecycle order. */
export const ORDER_FULFILMENT_STATUSES = Object.keys(ORDER_FULFILMENT_TRANSITIONS) as [
	OrderFulfilmentStatus,
	...OrderFulfilmentStatus[],
];

/** Every financial status, from unpaid to settled. */
export const ORDER_FINANCIAL_STATUSES = Object.keys(ORDER_FINANCIAL_TRANSITIONS) as [
	OrderFinancialStatus,
	...OrderFinancialStatus[],
];

export const isOrderFulfilmentStatus = (value: unknown): value is OrderFulfilmentStatus =>
	(ORDER_FULFILMENT_STATUSES as readonly string[]).includes(value as string);

export const isOrderFinancialStatus = (value: unknown): value is OrderFinancialStatus =>
	(ORDER_FINANCIAL_STATUSES as readonly string[]).includes(value as string);

/**
 * The fulfilment statuses nothing transitions out of — DERIVED from the table,
 * never hand-listed, so it cannot drift from it.
 *
 * Empty today, and that is the correct answer rather than an oversight:
 * operator un-delivery gives `delivered` an outgoing edge. Read it, do not
 * assume it.
 */
export const ORDER_FULFILMENT_TERMINAL_STATUSES: readonly OrderFulfilmentStatus[] =
	ORDER_FULFILMENT_STATUSES.filter((status) => ORDER_FULFILMENT_TRANSITIONS[status].length === 0);

export const isTerminalOrderFulfilmentStatus = (status: OrderFulfilmentStatus): boolean =>
	ORDER_FULFILMENT_TRANSITIONS[status].length === 0;

export {}; // NOSONAR