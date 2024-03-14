
declare global {

	interface Supplier {
		storeId: string;
		supplierId: string;
		createdAt: number;
		photoURL: string;
		company: string;
		cuit: number;
		razonSocial: string;
		// contact
		contactName: string;
		phone: number;
		email: string;
		// options
		balance: number;
		currencyId: number;
		service: boolean;
		disabled: boolean;
	}

	interface SupplierInvoice {
		storeId: string;
		invoiceId: string;
		createdAt: number;
		// invoice data
		type: 'FAC' | 'ND' | 'NC';
		dated: number;
		number: string;
		razonSocial: string;
		cuit: number;
		// details
		neto: number;
		iva10: number;
		iva21: number;
		total: number;
		per_iibb: number;
		per_iva: number;
		file: string;
		currencyValue: number;
	}

}

export { };