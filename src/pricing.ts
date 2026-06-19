declare global {
	/**
	 * ADR-0013 self-describing money stamp — STRICT (frozen rate required).
	 * Used ONLY on the new pricing-authoring shapes (PriceSlot[absolute] /
	 * PriceBreak / PricePromo). An optional frozen rate would reopen the
	 * live-rate hole (#1542). `currency` is bare `string` (catalogId) for parity
	 * with `Product.currency` — do NOT half-narrow to `CatalogId` while the
	 * entity stamps stay `string`. Do NOT retrofit this onto SupplierInvoice /
	 * SupplierAccount (optional-currency by design — would break supplier writes).
	 */
	interface CurrencyStamp {
		currency: string;
		currencyValue: number;
		currencyValueAt: number;
	}

	/**
	 * A named, extensible price list. Split OUT of the shared `Method` blob
	 * (`Method` is reused by 7 unrelated Store arrays — don't leak pricing into
	 * paymentMethods / ivaTypes). A structural SUPERSET of `Method` (keeps
	 * id / name / value? / removable? / editable?) so `store.priceLists:
	 * Method[] → PriceList[]` is type-compatible. `id` is the stable FK target
	 * for `Customer.priceList` + `PriceSlot.listId`.
	 */
	interface PriceList {
		id: number;
		name: string;
		value?: number; // carried from Method for retype-compat (unused semantically)
		removable?: boolean;
		editable?: boolean;
		order?: number; // explicit display ordering (was array-index)
		defaultCurrency?: string; // catalogId — a list's framing currency (per-list currency, Phase 2)
		tierGated?: boolean;
	}

	/**
	 * Quantity break within a slot. Resolution: highest `minQty <= qty` wins.
	 * Stored sorted ascending by `minQty`; no two breaks share a `minQty`
	 * (BE-validated). Open-ended top tier (no `maxQty` — ranges derive from the
	 * next break's `minQty`).
	 */
	interface PriceBreak extends CurrencyStamp {
		minQty: number; // > 0, integer
		amount: number; // absolute, raw (unrounded); rounded at display only
	}

	/** Time-limited promo override. `amount` is absolute. */
	interface PricePromo extends CurrencyStamp {
		from?: number; // unix ms; absent = active immediately
		until: number; // unix ms; REQUIRED — a promo without an end is just a price change
		amount: number; // absolute promo price, raw (percent-off promos out of scope v1)
	}

	/**
	 * One price list's pricing for a product. Discriminated union — kills the
	 * `{}`, both-set and neither-set invalid states; the `kind:'absolute' ⇒
	 * stamp` invariant rides the discriminant. `listId` is an FK to
	 * `PriceList.id`.
	 */
	type PriceSlot =
		| {
				kind: 'percent';
				listId: number;
				percent: number; // markup over Product.cost, ALWAYS resolved in Product.currency
				breaks?: PriceBreak[];
				promo?: PricePromo;
				visibleOnStorefront?: boolean; // default true
		  }
		| ({
				kind: 'absolute';
				listId: number;
				amount: number; // absolute, raw
				breaks?: PriceBreak[];
				promo?: PricePromo;
				visibleOnStorefront?: boolean;
		  } & CurrencyStamp); // amount ⇒ currency + currencyValue + currencyValueAt, enforced by the type
}

export {}; // NOSONAR
