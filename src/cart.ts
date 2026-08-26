
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

}

export {}; // NOSONAR
