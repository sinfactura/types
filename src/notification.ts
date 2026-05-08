
declare global {

	enum NotificationTypeEnum {
		ORDER = 'ORDER',
		MERCADOPAGO = 'MERCADOPAGO',
		DOLAROFICIAL = 'DOLAROFICIAL',
		DOLARINFORMAL = 'DOLARINFORMAL',
		DOLARBNA = 'DOLARBNA',
		ERROR = 'ERROR',
	}

	interface NotificationInterface {
		storeId: string;
		notificationId: string;
		createdAt: number;
		type: NotificationTypeEnum;
		title: string;
		orderId?: string;
		userId?: string;
		customerId?: string;
		read?: boolean;
		description?: string;
		details?: string;
		total?: number;
		TableName?: string;
	}

	// `Currency` (FX-rate time-series sample) moved to `currency.ts` and
	// renamed `currencyId` → `catalogId` in api#942.

}

export { };