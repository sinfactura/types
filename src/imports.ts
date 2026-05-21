
declare global {

	interface ProductSale {
		pk: string; // storeId-productId
		sk: string; // income-timeStamp
		orderId: string;
		customerId: string;
		fullName: string;
		quantity: number;
		price: number;
	}

	interface ProductIncome {
		pk: string; // storeId-productId
		sk: string; // income-timeStamp
		orderId?: string; // when we put items trough a buy order
		supplierId: string;
		supplierName?: string;
		quantity: number;
		cost: number;
	}

}
export {}; // NOSONAR