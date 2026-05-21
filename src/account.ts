
declare global {

	interface Account {
		storeId: string;
		accountId: string;
		orderId?: string;
		createdAt: number; // timestamp
		dated: number; // 20220123
		customerId?: string;
		fullName?: string;
		subject?: string;
		details: string;
		debit?: number;
		credit?: number;
		amount?: number;
		// catalogId (api#942) — FK to PlatformCurrency. Promoted from the
		// api#945 module augmentation (app#1539 / ADR-0013).
		currency?: string;
		currencyValue?: number;
		// Unix ms at which `currencyValue` was effective (app#1539 / ADR-0013).
		currencyValueAt?: number;
		balance?: number;
		userId: string;
		deleted?: boolean;
	}

}

export {}; // NOSONAR