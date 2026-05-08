
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