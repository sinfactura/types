
declare global {

	interface Product {
		storeId: string;
		productId: string;
		createdAt: number;
		updatedAt: number;
		disabled: boolean;
		search: string;
		// BASE
		sku: string;
		name: string;
		description?: string;
		pictures?: {
			url: string;
			base64?: string;
			primary?: boolean;
		}[];
		stock: number;
		limit?: number;
		incomes?: {
			stockId: string;
			orderId?: string; // when we put items trough a buy order
			supplierName?: string;
			quantity: number;
			cost: number;
		}[];
		sales?: {
			stockId: string;
			orderId: string;
			fullName: string;
			quantity: number;
			price: number;
		}[];
		totalIncomes?: number;
		totalSales?: number;
		zone?: string;

		// OPTIONS
		// catalogId (api#942) — FK to PlatformCurrency. Was a
		// tenant-local integer; now resolves via the catalog directly.
		currency: string;
		ivaType: number;
		categoryId: string;
		brandId: string;
		inOffer: boolean;
		isNew: boolean;
		isService: boolean;

		// PRICES
		cost: number;
		price1: number;
		price2: number;
		price3: number;
		price4: number;
	}

}

export { };