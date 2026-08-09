
declare global {

	interface Basket {
		storeId: string;
		customerId: string;
		customer: Partial<Customer>;
		createdAt: number;
		updatedAt: number;
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

	// Response envelope sibling to `data` on `POST /basket?mode=merge`.
	interface BasketMergeMeta {
		// productIds from the request `items[]` that didn't resolve to a real
		// product — never written to the basket.
		droppedSkus: string[];
		// Count of distinct incoming productIds that WERE successfully merged.
		mergedCount: number;
	}

}

export {}; // NOSONAR