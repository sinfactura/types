
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
		comments?: string;
		currency: string; // catalogId — FK to PlatformCurrency
		// Self-describing currency stamp (ADR-0013): FX rate and the Unix ms at which it was effective.
		currencyValue?: number;
		currencyValueAt?: number;
		paymentMethod: number;
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
		total: number;
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
		 * primitive here.
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
		};
		// fiscal_documents upload outcome: 'pending' while in flight, 'uploaded'
		// on success, 'failed' on error. Absent = no invoice issued yet.
		fiscalDocumentStatus?: 'uploaded' | 'failed' | 'pending';
	}

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
	interface CreateOrderRequest extends Partial<Order> {
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

export {}; // NOSONAR