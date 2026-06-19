
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
		// NEW canonical pricing (A-prime, #1780). Operators author ONLY this;
		// the BE materializes price1..4 below from it on every write. See ADR-0014.
		prices?: PriceSlot[];
		// MATERIALIZED read-projection (the legacy shim, BE-derived from `prices[]`).
		// priceN = the list's ordinal POSITION 1..4 (NOT listId). Stays a
		// dimensionless percent over `cost`:
		//   - kind:'percent'  → priceN = percent
		//   - kind:'absolute', same currency as cost → priceN = round((amount/cost-1)*100)
		//   - kind:'absolute', currency != Product.currency → priceN OMITTED (undefined);
		//     legacy 4-percent readers can't represent it → consumers read `prices[]`.
		// Optional because the cross-currency case omits them. (#1780)
		price1?: number;
		price2?: number;
		price3?: number;
		price4?: number;
	}

}

export {}; // NOSONAR