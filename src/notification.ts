
declare global {

	interface NotificationInterface {
		storeId: string;
		notificationId: string;
		createdAt: number;
		type: 'order' | 'mercadopago' | 'dollarOficial' | 'dollarInformal' | 'dollarBna';
		title: string;
		orderId?: string;
		userId?: string;
		read?: boolean;
		description?: string;
		details?: string;
		total?: number;
	}

	interface Currency {
		currencyId: string;
		dated: string;
		value: number;
		name?: string;
	}

}

export { };