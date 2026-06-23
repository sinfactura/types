
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
		// Self-describing currency stamp (app#1539 / ADR-0013): FX rate and
		// the Unix ms at which it was effective.
		currencyValue?: number;
		currencyValueAt?: number;
		ivaType: number;
		categoryId: string;
		brandId: string;
		// READ-PROJECTION of "any slot has an active promo" — never authored. (#1780)
		inOffer: boolean;
		isNew: boolean;
		isService: boolean;

		// PRICES
		cost: number;
		// Canonical pricing (A-prime, #1780). Operators author ONLY this. The
		// materialized price1..4 shim was removed end-of-epic; all consumers
		// read `prices[]` directly. See ADR-0014.
		prices?: PriceSlot[];
	}

}

export {}; // NOSONAR