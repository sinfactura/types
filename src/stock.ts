
declare global {

	interface StockBase {
		storeId: string;
		stockId: string; // income-PROD000330
		createdAt: number; // add when insert an item
		cost: number; // 1.23
		skip?: boolean // new to replace old notEvaluate // unnecesary in all new inserts
	}

	interface StockIncome extends StockBase {
		quantity: number; // income
		supplierId?: number; // income
		supplierName?: string; // income
	}

	interface StockSale extends StockBase {
		customerId?: string; // sale
		fullName?: string; // sale
		ivaType?: number; // sale
		orderId?: string; // sale
		price?: number; // sale
	}

}

export { };