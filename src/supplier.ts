
declare global {

	interface Supplier {
		storeId: string;
		supplierId: string;
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
		service: boolean; // true is service
		disabled: boolean;
	}

}

export { };