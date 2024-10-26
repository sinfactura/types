
declare global {

	interface Order {
		storeId: string;
		orderId: string;
		customerId: string;
		customer: Partial<Customer>;
		createdAt: number;
		updatedAt?: number;
		readyAt?: number;
		deliveredAt?: number;
		deliveredDate?: number;
		comments?: string;
		currency: number;
		paymentMethod: number;
		deliveryMethod: number;
		invoiceMethod?: {
			condFiscal: number;
			condFiscalName: string;
			cuit: string;
			razonSocial: string;
		};
		cost: number;
		total: number;
		discount: number;
		orderPrinted?: boolean;
		tagPrinted?: boolean;
		invoices?: Partial<Invoice>[];
		disabled?: boolean;
		items: Partial<BasketItem>[];
	}

	interface ZebraTag {
		orderId: string;
		fullName: string;
		phone: string;
		address: string;
		city: string;
		quantity: number;
		comments: string;
		sender: {
			razonSocial: string;
			cuit: string;
			phone: string;
			address: string;
			city: string;
			postalCode: string;
			province: string;
		};
	}

}

export { };