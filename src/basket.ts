
declare global {

	/**
	 * @deprecated Use `Cart`. Superseded by the re-keyed cart (one row per cart at
	 * its own minted `cartId`, rather than one row per customer at
	 * `BASKET#{storeId}` / `{customerId}`).
	 *
	 * Both front ends are off this shape. It stays PUBLISHED so any consumer still
	 * compiling against it keeps compiling — the tag is a compiler nudge, not a
	 * removal announcement. New code must not reference it.
	 *
	 * ⚠️ `Order.items` is NOT covered by this: it is `Partial<CartLine>[]`, and
	 * `CartLine` is structurally a superset of `BasketItem`. Anywhere an order
	 * line is being typed, `CartLine` is the correct name and always was.
	 */
	interface Basket {
		storeId: string;
		customerId: string;
		customer: Partial<Customer>;
		createdAt: number;
		updatedAt: number;
		// Optimistic-concurrency token. OPTIONAL on purpose, in both directions:
		// a row written before this field existed simply has none, and a client
		// that omits it on a write gets today's UNCONDITIONAL behaviour (the
		// server still bumps the counter). Send it and the write becomes a
		// compare-and-swap: a mismatch is `409` with `error: 'BASKET_VERSION_CONFLICT'`
		// and `data` carrying the current server row, so the client can rebase
		// rather than retry. That two-way optionality is what lets the api ship
		// ahead of app + storefront without breaking either.
		version?: number;
		quantity: number;
		// catalogId — FK to PlatformCurrency.
		currency: string,
		// Self-describing currency stamp (ADR-0013): FX rate + the Unix ms it was effective.
		currencyValue?: number;
		currencyValueAt?: number;
		cost: number;
		total: number;
		items: BasketItem[];
	}

	/**
	 * @deprecated Use `CartLine`, which is a structural superset — every field
	 * below is present on it, plus `lineId`. See the note on `Basket`.
	 */
	interface BasketItem {
		dated: number;
		productId: string;
		sku: string;
		pictures: Product[ 'pictures' ]
		name: string;
		zone?: string;
		quantity: number;
		ivaType: number,
		cost: number;
		price: number; // the resolved unit price, in the line's own currency
		// A-prime line provenance. Inlined OPTIONAL (NOT `extends CurrencyStamp`)
		// so existing un-stamped lines stay valid.
		listId?: number; // which PriceList resolved this line
		currency?: string; // catalogId — per-line (a USD-list line + an ARS-list line can coexist)
		currencyValue?: number; // frozen FX at re-price time
		currencyValueAt?: number;
		priceSource?: 'percent' | 'amount';
		appliedMinQty?: number; // the break tier that fired
		promoApplied?: boolean;
		basePrice?: number; // pre-promo unit price
	}

	/**
	 * @deprecated Nothing emits this. `?mode=merge` and its sibling actions now
	 * return ONE envelope — `{ message, data, droppedSkus }` — with `droppedSkus`
	 * as a top-level key rather than nested under `mergeMeta`, and `mergedCount`
	 * derived by the caller from what was NOT dropped.
	 */
	interface BasketMergeMeta {
		// productIds from the request `items[]` that didn't resolve to a real
		// product — never written to the basket.
		droppedSkus: string[];
		// Count of distinct incoming productIds that WERE successfully merged.
		mergedCount: number;
	}

}

export {}; // NOSONAR