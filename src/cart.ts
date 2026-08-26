
declare global {

	/**
	 * A cart, keyed by its OWN minted id rather than by the customer.
	 *
	 * Replaces `Basket`, which keyed one cart per customer at `BASKET#{storeId}` /
	 * `{customerId}`. ⚠️ `Basket` and `BasketItem` STAY published and are not
	 * deprecated: the migration is forward-only with a permanent tolerant reader,
	 * so legacy rows keep their old shape and never stop existing.
	 */
	interface Cart {
		// CART000001 — minted through the atomic counter. Gaps are contractual and
		// never reused.
		cartId: string;
		storeId: string;
		// An ATTRIBUTE now, not the SK, and indexed by the existing PK-customerId
		// GSI. Optional because a parked POS ticket has no customer attached yet.
		customerId?: string;
		customer?: Partial<Customer>;
		channel: 'pos' | 'web';
		// Slot reserved for parked/held POS tickets. Nothing populates it yet.
		terminalId?: string;
		// Slots reserved for the cart lifecycle. Nothing populates them yet.
		status?: 'active' | 'abandoned' | 'converted';
		ttl?: number;
		// Optimistic-concurrency token, same two-way optionality as `Basket.version`:
		// omit it for an unconditional write, send it to make the write a CAS whose
		// mismatch is `409 BASKET_VERSION_CONFLICT` carrying the current row.
		// ⚠️ Unlike the legacy path there is NO expected-0 sentinel here. A client
		// cannot address a cart it has no `cartId` for, so "expected 0" has no
		// client-side meaning; existence is asserted with `attribute_not_exists(PK)`
		// against a fresh SK, which — unlike `attribute_not_exists(version)` — cannot
		// be poisoned by a stray stored attribute.
		version?: number;
		lines: CartLine[];
		totals: CartTotals;
		convertedOrderId?: string;
		createdAt: number;
		updatedAt: number;
		entityType?: string;
	}

	interface CartLine {
		// Distinct from `productId` ON PURPOSE — this is what lets the same product
		// appear twice on one cart with different notes, serials, options or gift
		// messages, which the `BasketItem` shape made impossible.
		lineId: string;
		productId: string;
		dated: number;
		sku: string;
		pictures: Product['pictures'];
		name: string;
		zone?: string;
		quantity: number;
		ivaType: number;
		cost: number;
		// The resolved unit price, in the line's own currency.
		price: number;
		// Price provenance, carried over from `BasketItem` verbatim. Do NOT rename:
		// the write path populates these and the names are the contract.
		listId?: number;
		currency?: string;
		// Self-describing currency stamp (ADR-0013): FX rate + the Unix ms it was
		// effective. PER LINE, because each line is stamped at its own re-price
		// instant — which is precisely why `CartTotals` carries no such pair.
		currencyValue?: number;
		currencyValueAt?: number;
		priceSource?: 'percent' | 'amount';
		appliedMinQty?: number;
		promoApplied?: boolean;
		basePrice?: number;
		// Slots reserved for discounts and save-for-later. Nothing populates them yet.
		discount?: CartDiscount;
		savedAt?: number;
	}

	/**
	 * Row-level totals, replacing `Basket`'s loose `cost` / `total` / `quantity`
	 * scalars.
	 *
	 * ⚠️ There is deliberately NO `currencyValue` / `currencyValueAt` here. On
	 * `Basket` they were declared and never written — but the reason they are gone
	 * is stronger than "unwritten": a cart CANNOT HAVE one correct value for them.
	 * Lines are stamped independently at their own re-price instants, so a cart
	 * whose lines were priced ten minutes apart carries two rates and there is no
	 * principled way to pick one. The field is unrepresentable, not merely a
	 * phantom. Read the rate per line. `currency` stays: it is row-level and
	 * load-bearing, sourcing the order's currency at checkout.
	 */
	interface CartTotals {
		subtotal: number;
		// Slot reserved for cart-level discounts; 0 until then.
		discount: number;
		tax: number;
		shipping: number;
		grandTotal: number;
		currency: string;
		// ⚠️ REQUIRED, and not cosmetic: checkout copies this onto the ORDER row and
		// onto the SALE audit row. Drop it and every order created from a cart
		// records a cost of 0, silently zeroing margin reporting.
		cost: number;
		// Not read by the api. Both front ends render a cart badge from it, and it
		// is a total, so it belongs here.
		quantity: number;
	}

	interface CartDiscount {
		code?: string;
		amount: number;
		type: 'percent' | 'amount';
	}

	/**
	 * The PHYSICAL key a cart was read from.
	 *
	 * ⚠️ Exists because a re-key makes a re-derived key silently wrong rather than
	 * loudly wrong: DynamoDB's `Delete` on a key that does not exist SUCCEEDS, so a
	 * writer that rebuilds `{ PK: BASKET#{storeId}, SK: customerId }` against a row
	 * now living at `CART#{storeId}` / `{cartId}` completes, reports success, and
	 * empties nothing. Carry this from the read and use it — never re-derive.
	 */
	interface CartRef {
		// 'CART#{storeId}' | 'BASKET#{storeId}'
		PK: string;
		// '{cartId}' | '{customerId}'
		SK: string;
		// The row was read from a legacy BASKET# partition.
		legacy: boolean;
	}

	/**
	 * The request body for every cart mutation, discriminated on `mode`.
	 *
	 * Replaces the overloaded `POST /basket`, where ONE verb carried five meanings
	 * — set, sum, remove, clear, and an emergent "empty the last line and the row
	 * disappears" — distinguished only by which fields happened to be present.
	 *
	 * ⚠️ ONE schema set serves BOTH surfaces (`/baskets` on the App API and
	 * `/basket` on the Web API). That is what makes the unresolvable-product policy
	 * identical across them STRUCTURALLY, rather than two implementations that
	 * agree today. Do not fork it per surface.
	 *
	 * Constraints the type system cannot express, enforced in zod at the handler
	 * and stated here because a `.d.ts` reader has no other way to learn them:
	 * - `productId` matches `/^PROD\d{6,10}$/`; `lineId` matches `/^L\d{4,}$/`.
	 * - `quantity` is `min(0).max(1_000_000)` and is deliberately NOT an integer:
	 *   weight-priced products carry fractional quantities. The maximum is overflow
	 *   hygiene — an absurd quantity takes the running total to `Infinity` and dies
	 *   at the DynamoDB marshaller instead of at validation.
	 * - `merge.items` is `min(1).max(50)`.
	 */
	type CartActionRequest =
		| CartActionAddLine
		| CartActionChangeQuantity
		| CartActionRemoveLine
		| CartActionClear
		| CartActionMerge;

	/**
	 * Fields common to every action.
	 *
	 * ⚠️ `version` being OPTIONAL is what lets the server deploy ahead of either
	 * front end: an FE that does not yet send it gets an unconditional write rather
	 * than a rejection. Send it to make the write a CAS whose mismatch is a `409`
	 * carrying the current row.
	 */
	interface CartActionBase {
		// Integer >= 0. Absent means an unconditional write.
		version?: number;
		idempotencyKey?: string;
	}

	/**
	 * SUMS into an existing line. Contrast `CartActionChangeQuantity`, which SETS —
	 * the split between these two is the entire point of the named-action contract.
	 */
	interface CartActionAddLine extends CartActionBase {
		mode: 'addLine';
		productId: string;
		// The ONE quantity that excludes 0: adding zero of something is not an add,
		// and removal has its own action.
		quantity: number;
		/**
		 * Targets one specific line when several share a `productId` — a state
		 * `lineId` exists to make addressable.
		 *
		 * Resolution when ABSENT is total and never errors: sum into the sole line
		 * for that product; create one if none exists; APPEND a new line if several
		 * do. Named-but-unknown is a client error, unlike a removal, which has an
		 * idempotent reading.
		 */
		lineId?: string;
		// Accepted for FE back-compat and DISCARDED — the server re-derives every
		// price. Declared rather than dropped so the next implementer does not
		// conclude it is honoured.
		price?: number;
	}

	/** SETS the line to `quantity`. A quantity of 0 removes the line. */
	interface CartActionChangeQuantity extends CartActionBase {
		mode: 'changeQuantity';
		lineId: string;
		// 0 removes. On an ALREADY-ABSENT line this is a no-op rather than an error,
		// because a removal is idempotent.
		quantity: number;
		// Accepted and DISCARDED — see `CartActionAddLine.price`.
		price?: number;
	}

	interface CartActionRemoveLine extends CartActionBase {
		mode: 'removeLine';
		lineId: string;
	}

	/**
	 * Empties `lines` to `[]`.
	 *
	 * ⚠️ The ROW AND ITS `cartId` SURVIVE. The pre-2-F behaviour deleted the row
	 * when the last line went, which threw away the stable identity the re-key
	 * existed to mint — and made `status: 'abandoned'` unrepresentable for exactly
	 * the carts most likely to be abandoned. Physical deletion now survives only at
	 * checkout conversion and tenant purge.
	 */
	interface CartActionClear extends CartActionBase {
		mode: 'clear';
	}

	/**
	 * Bulk-folds a client-side cart into the stored one.
	 *
	 * ⚠️ Per-item quantity SUMS into the existing line, EXCEPT `0`, which sets the
	 * line to zero and removes it. An FE reading "merge sums" and sending 0
	 * expecting a no-op will remove the line instead. Two consequences fall out:
	 * intra-request dedupe happens FIRST, so a payload naming one product twice
	 * sums against itself before it sums against the stored line; and a brand-new
	 * product at quantity 0 adds nothing, being a removal of something absent.
	 */
	interface CartActionMerge extends CartActionBase {
		mode: 'merge';
		items: { productId: string; quantity: number }[];
	}

	/**
	 * The response to every cart mutation.
	 *
	 * ⚠️ `droppedSkus` is REQUIRED and always present — an empty array when nothing
	 * was dropped. It is declared non-optional so an FE cannot treat it as an
	 * optional diagnostic: an unresolvable product is SOFT-DROPPED on every action,
	 * so a single-item `addLine` naming a deleted product returns 200 having done
	 * nothing, and this array is the only thing that says so.
	 *
	 * Soft-drop is uniform by design. The alternative — a hard 400, which the
	 * pre-2-F single POST did — strands a shopper behind a line whose product was
	 * deleted, unable to remove it because removing it is itself a write that
	 * re-validates the product.
	 */
	interface CartActionResponse {
		cart: Cart;
		droppedSkus: string[];
	}


}

export {}; // NOSONAR
