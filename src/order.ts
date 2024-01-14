
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
			cuit: number;
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

}

export { };