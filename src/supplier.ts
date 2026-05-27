
declare global {

	interface Supplier {
		storeId: string;
		userId: string;
		supplierId: string;
		createdAt: number;
		photoURL: string;
		company: string;
		cuit: string;
		razonSocial: string;
		// contact
		contactName: string;
		phone: number;
		email: string;
		// options
		balance: number;
		// catalogId (api#942) — FK to PlatformCurrency.
		currencyId: string;
		service: boolean;
		disabled: boolean;
	}

	interface SupplierInvoice {
		storeId: string;
		userId: string;
		invoiceId: string;
		supplierId: string;
		createdAt: number;
		// invoice data
		type: 'FAC' | 'ND' | 'NC';
		dated: number;
		number: string;
		razonSocial: string;
		cuit: string;
		// details
		neto: number;
		iva10: number;
		iva21: number;
		total: number;
		per_iibb: number;
		per_iva: number;
		file: string;
		// catalogId (api#942) — FK to PlatformCurrency (app#1539 / ADR-0013).
		currency?: string;
		currencyValue: number;
		// Unix ms at which `currencyValue` was effective (app#1539 / ADR-0013).
		currencyValueAt?: number;
		// Lowercase '#'-joined search index, written by
		// `buildSupplierInvoiceSearch` on every insert/update (api#1233).
		search?: string;
	}

	interface SupplierAccount {
		storeId: string;
		userId: string;
		accountId: string;
		supplierId: string;
		createdAt: number; // timestamp
		dated: number; // 20220123
		fullName: string;
		subject: string;
		details: string;
		debit: number;
		credit: number;
		amount: number;
		// catalogId (api#942) — FK to PlatformCurrency. Promoted from the
		// api#945 module augmentation (app#1539 / ADR-0013).
		currency?: string;
		currencyValue: number;
		// Unix ms at which `currencyValue` was effective (app#1539 / ADR-0013).
		currencyValueAt?: number;
		balance: number;
		deleted: boolean;
	}

}

export {}; // NOSONAR