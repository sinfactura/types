
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
		price: number;
	}

}

export { };