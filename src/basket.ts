
declare global {

	interface Basket {
		storeId: string;
		customerId: string;
		customer: Partial<Customer>;
		createdAt: number;
		updatedAt: number;
		quantity: number;
		// catalogId (api#942) — FK to PlatformCurrency.
		currency: string,
		// Self-describing currency stamp (app#1539 / ADR-0013): FX rate and
		// the Unix ms at which it was effective.
		currencyValue?: number;
		currencyValueAt?: number;
		cost: number;
		total: number;
		items: BasketItem[];
	}

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
		// A-prime line provenance (#1780 / types#86). Inlined OPTIONAL (NOT
		// `extends CurrencyStamp`) so existing un-stamped lines stay valid.
		listId?: number; // which PriceList resolved this line
		currency?: string; // catalogId — per-line (a USD-list line + an ARS-list line can coexist)
		currencyValue?: number; // frozen FX at re-price time
		currencyValueAt?: number;
		priceSource?: 'percent' | 'amount';
		appliedMinQty?: number; // the break tier that fired
		promoApplied?: boolean;
		basePrice?: number; // pre-promo unit price
	}

}

export {}; // NOSONAR