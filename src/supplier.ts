
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

}

export { };